use img_parts::jpeg::Jpeg;
use img_parts::jpeg::JpegSegment;
use img_parts::Bytes;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MotionError {
    #[error("JPEG processing error: {0}")]
    Jpeg(String),
}

struct SefTag<'a> {
    id: [u8; 4],
    name: &'static str,
    payload: &'a [u8],
}

/// Mux an image and a video entirely in memory, returning the combined motion-photo bytes.
///
/// accepted `mime`:
/// - `video/mp4`
/// - `video/quicktime`
pub fn mux(
    image_bytes: &[u8],
    video_bytes: &[u8],
    mime: &str,
) -> Result<Vec<u8>, MotionError> {
    const SEFH_VERSION: u32 = 107;
    const TAG_MOTION_PHOTO_DATA: [u8; 4] = [0x00, 0x00, 0x30, 0x0A];
    const TAG_MOTION_PHOTO_VERSION: [u8; 4] = [0x00, 0x00, 0x31, 0x0A];

    // NOTE: Data tag FIRST (video payload sits right after its own small
    // header, immediately following the JPEG), Version tag SECOND.
    let tags = [
        SefTag {
            id: TAG_MOTION_PHOTO_DATA,
            name: "MotionPhoto_Data",
            payload: video_bytes,
        },
        SefTag {
            id: TAG_MOTION_PHOTO_VERSION,
            name: "MotionPhoto_Version",
            payload: b"mpv3",
        },
    ];

    let mut tag_data = Vec::new();
    let mut tag_lengths = Vec::new();
    let mut video_padstart: usize = 0;

    for (i, tag) in tags.iter().enumerate() {
        let start = tag_data.len();
        tag_data.extend_from_slice(&tag.id);
        tag_data.extend_from_slice(&(tag.name.len() as u32).to_le_bytes());
        tag_data.extend_from_slice(tag.name.as_bytes());

        if i == 0 {
            // padding = header only (id+namelen+name), before raw video bytes
            video_padstart = tag_data.len() - start;
        }

        tag_data.extend_from_slice(tag.payload);
        tag_lengths.push((tag_data.len() - start) as u32);
    }

    let mut offsets = vec![0u32; tags.len()];
    for (i, len) in tag_lengths.iter().enumerate() {
        for offset in offsets.iter_mut().take(i + 1) {
            *offset += len;
        }
    }

    let mut sefh = Vec::new();
    sefh.extend_from_slice(b"SEFH");
    sefh.extend_from_slice(&SEFH_VERSION.to_le_bytes());
    sefh.extend_from_slice(&(tags.len() as u32).to_le_bytes());
    for ((tag, &offset), &len) in tags.iter().zip(&offsets).zip(&tag_lengths) {
        sefh.extend_from_slice(&tag.id);
        sefh.extend_from_slice(&offset.to_le_bytes());
        sefh.extend_from_slice(&len.to_le_bytes());
    }
    let sefh_len = sefh.len() as u32;
    sefh.extend_from_slice(&sefh_len.to_le_bytes());
    sefh.extend_from_slice(b"SEFT");

    let total_trailing = tag_data.len() + sefh.len();
    let video_len = total_trailing - video_padstart;

    let xmp_packet = format!(
        r#"<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description 
    xmlns:GCamera="http://ns.google.com/photos/1.0/camera/"
    xmlns:OpCamera="http://ns.oplus.com/photos/1.0/camera/"
    xmlns:MiCamera="http://ns.xiaomi.com/photos/1.0/camera/"
    xmlns:Container="http://ns.google.com/photos/1.0/container/" 
    xmlns:Item="http://ns.google.com/photos/1.0/container/item/" 
    rdf:about="" 
    GCamera:MotionPhoto="1" 
    GCamera:MotionPhotoVersion="1" 
    GCamera:MotionPhotoPresentationTimestampUs="0"
    OpCamera:MotionPhotoPrimaryPresentationTimestampUs="0"
    OpCamera:MotionPhotoOwner="oplus"
    OpCamera:OLivePhotoVersion="2"
    OpCamera:VideoLength="{}"
    GCamera:MicroVideoVersion="1"
    GCamera:MicroVideo="1"
    GCamera:MicroVideoOffset="{}"
    GCamera:MicroVideoPresentationTimestampUs="0"
    MiCamera:XMPMeta="&lt;?xml version='1.0' encoding='UTF-8' standalone='yes' ?&gt;">
      <Container:Directory>
        <rdf:Seq>
          <rdf:li rdf:parseType="Resource">
            <Container:Item
                Item:Mime="image/jpeg"
                Item:Semantic="Primary"
                Item:Length="0" 
                Item:Padding="{}"/>
          </rdf:li>
          <rdf:li rdf:parseType="Resource">
            <Container:Item
                Item:Mime="{}"
                Item:Semantic="MotionPhoto"
                Item:Length="{}"
                Item:Padding="0"/>
          </rdf:li>
        </rdf:Seq>
      </Container:Directory>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"#,
        video_len, video_len, video_padstart, &mime, video_len
    );

    let sign = b"http://ns.adobe.com/xap/1.0/\0";
    let mut payload = Vec::with_capacity(sign.len() + xmp_packet.len());
    payload.extend_from_slice(sign);
    payload.extend_from_slice(xmp_packet.as_bytes());

    let mut jpeg = Jpeg::from_bytes(Bytes::from(image_bytes.to_vec()))
        .map_err(|e| MotionError::Jpeg(e.to_string()))?;
    jpeg.segments_mut().retain(|seg| {
        if seg.marker() != 0xE1 {
            return true;
        }
        !seg.contents().starts_with(sign)
    });
    let xmp_segment = JpegSegment::new_with_contents(0xE1, Bytes::from(payload));
    jpeg.segments_mut().insert(1, xmp_segment);

    let mut motion_bytes = Vec::new();
    jpeg.encoder()
        .write_to(&mut motion_bytes)
        .map_err(|e| MotionError::Jpeg(e.to_string()))?;

    // [JPEG] [Data-tag-header][raw video][Version tag][SEFH][SEFT]
    motion_bytes.extend_from_slice(&tag_data);
    motion_bytes.extend_from_slice(&sefh);

    Ok(motion_bytes)
}
