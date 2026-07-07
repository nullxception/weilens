pub fn merge_bottom_three_percent(wm_bytes: &[u8], no_wm_bytes: &[u8]) -> Result<Vec<u8>, String> {
    use image::{GenericImage, GenericImageView};

    let mut img_wm = image::load_from_memory(wm_bytes)
        .map_err(|e| format!("Failed to load watermarked image: {}", e))?;
    let img_no_wm = image::load_from_memory(no_wm_bytes)
        .map_err(|e| format!("Failed to load no-watermark image: {}", e))?;

    let (width, height) = img_wm.dimensions();
    let resized_no_wm =
        img_no_wm.resize_exact(width, height, image::imageops::FilterType::Triangle);

    let strip_height = std::cmp::max(1, (height as f32 * 0.03).round() as u32);
    let start_y = height.saturating_sub(strip_height);

    for y in start_y..height {
        for x in 0..width {
            let pixel = resized_no_wm.get_pixel(x, y);
            img_wm.put_pixel(x, y, pixel);
        }
    }

    let mut out_bytes = std::io::Cursor::new(Vec::new());
    img_wm
        .write_to(&mut out_bytes, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode merged image: {}", e))?;

    Ok(out_bytes.into_inner())
}
