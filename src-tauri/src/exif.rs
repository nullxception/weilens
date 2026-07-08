use crate::types::GpsData;
use little_exif::exif_tag::ExifTag;
use little_exif::metadata::Metadata;
use little_exif::rational::{iR64, uR64};
use rand::Rng;
use std::path::Path;

#[derive(Debug, Clone, Copy)] // Required for .copied()
struct IPhoneExif {
    shortname: &'static str,
    name: &'static str,
    lens_model: &'static str,
    release_date: &'static str,
}

fn get_iphone_model(exif_date_str: &str) -> IPhoneExif {
    static MODELS: &[IPhoneExif] = &[
        IPhoneExif {
            shortname: "A11PM",
            name: "iPhone 11 Pro Max",
            lens_model: "back triple camera 4.25mm f/1.8",
            release_date: "2019:09:20",
        },
        IPhoneExif {
            shortname: "A12PM",
            name: "iPhone 12 Pro Max",
            lens_model: "back camera 5.1mm f/1.6",
            release_date: "2020:11:13",
        },
        IPhoneExif {
            shortname: "A13PM",
            name: "iPhone 13 Pro Max",
            lens_model: "back triple camera 5.7mm f/1.5",
            release_date: "2021:09:24",
        },
        IPhoneExif {
            shortname: "A14PM",
            name: "iPhone 14 Pro Max",
            lens_model: "back triple camera 6.86mm f/1.78",
            release_date: "2022:09:16",
        },
        IPhoneExif {
            shortname: "A15PM",
            name: "iPhone 15 Pro Max",
            lens_model: "back triple camera 6.86mm f/1.78",
            release_date: "2023:09:22",
        },
        IPhoneExif {
            shortname: "A16PM",
            name: "iPhone 16 Pro Max",
            lens_model: "back triple camera 6.86mm f/1.78",
            release_date: "2024:09:20",
        },
        IPhoneExif {
            shortname: "A17PM",
            name: "iPhone 17 Pro Max",
            lens_model: "back triple camera 6.86mm f/1.78",
            release_date: "2025:09:19",
        },
    ];

    let created = exif_date_str.get(..10).unwrap_or("");

    MODELS
        .iter()
        .rev()
        .find(|p| created >= p.release_date)
        .copied()
        .unwrap_or(MODELS[0]) // Default to the first model if none match
}

pub fn write_exif(
    file_path: &Path,
    exif_date: &str,
    location: Option<&GpsData>,
) -> Result<(), String> {
    let mut metadata = match Metadata::new_from_path(file_path) {
        Ok(m) => m,
        Err(e) => {
            log::info!(
                "No existing EXIF metadata or read error: {:?}. Creating new metadata.",
                e
            );
            Metadata::new()
        }
    };

    let phone_model = get_iphone_model(exif_date);

    metadata.set_tag(ExifTag::DateTimeOriginal(exif_date.into()));
    metadata.set_tag(ExifTag::CreateDate(exif_date.into()));
    metadata.set_tag(ExifTag::ModifyDate(exif_date.into()));

    // Phone and lens information
    metadata.set_tag(ExifTag::Make("Apple".into()));
    metadata.set_tag(ExifTag::Model(phone_model.name.into()));
    metadata.set_tag(ExifTag::Software(("26.5.0").into()));
    metadata.set_tag(ExifTag::LensMake("Apple".into()));
    metadata.set_tag(ExifTag::LensModel(format!(
        "{} {}",
        phone_model.name, phone_model.lens_model
    )));
    metadata.set_tag(ExifTag::ImageUniqueID(format!(
        "{}00000000000000000",
        phone_model.shortname
    )));
    metadata.set_tag(ExifTag::ExifVersion(vec![0232]));
    metadata.set_tag(ExifTag::ComponentsConfiguration(vec![1, 2, 3, 0]));
    let mut rng = rand::rng();
    // Exposure
    metadata.set_tag(ExifTag::ExposureTime(vec![uR64 {
        nominator: 1,
        denominator: rng.random_range(100..=200),
    }])); // 1/(100-200) sec
    metadata.set_tag(ExifTag::ISO(vec![rng.random_range(60..=99)])); //60-99
    metadata.set_tag(ExifTag::FocalLength(vec![uR64 {
        nominator: rng.random_range(686..=693),
        denominator: 100,
    }])); // 6.86-6.93
    metadata.set_tag(ExifTag::FNumber(vec![uR64::from(1.8)])); // f/1.8
    metadata.set_tag(ExifTag::ExposureProgram(vec![2])); // Program AE
    metadata.set_tag(ExifTag::MeteringMode(vec![5])); // Multi-segment
    metadata.set_tag(ExifTag::Flash(vec![16])); // Flash did not fire

    metadata.set_tag(ExifTag::FocalLengthIn35mmFormat(vec![24])); // 24 mm equivalent
    metadata.set_tag(ExifTag::ExposureCompensation(vec![iR64 {
        nominator: -1,
        denominator: 1,
    }]));

    // White balance
    metadata.set_tag(ExifTag::WhiteBalance(vec![0])); // Auto

    // Color space
    metadata.set_tag(ExifTag::ColorSpace(vec![1])); // sRGB

    metadata.set_tag(ExifTag::Orientation(vec![1])); // Normal
    metadata.set_tag(ExifTag::ResolutionUnit(vec![2])); // Inches
    metadata.set_tag(ExifTag::XResolution(vec![uR64::from(72)]));
    metadata.set_tag(ExifTag::YResolution(vec![uR64::from(72)]));
    metadata.set_tag(ExifTag::SceneCaptureType(vec![0])); // Standard
    metadata.set_tag(ExifTag::DigitalZoomRatio(vec![uR64::from(1)])); // 1×

    if let Some(gps) = location {
        let lat_ref = if gps.lat >= 0.0 { "N" } else { "S" };
        metadata.set_tag(ExifTag::GPSLatitudeRef(lat_ref.into()));
        let lon_ref = if gps.lon >= 0.0 { "E" } else { "W" };
        metadata.set_tag(ExifTag::GPSLongitudeRef(lon_ref.into()));

        let build_dms = |coord: f64| -> Vec<uR64> {
            let abs = coord.abs();
            let deg = abs.trunc() as u32;
            let min_f = (abs - deg as f64) * 60.0;
            let min = min_f.trunc() as u32;
            let sec_f = (min_f - min as f64) * 60.0;
            vec![uR64::from(deg), uR64::from(min), uR64::from(sec_f)]
        };

        let lat_components = build_dms(gps.lat);
        metadata.set_tag(ExifTag::GPSLatitude(lat_components));

        let lon_components = build_dms(gps.lon);
        metadata.set_tag(ExifTag::GPSLongitude(lon_components));
    }

    metadata
        .write_to_file(file_path)
        .map_err(|e| format!("Metadata write error: {:?}", e))?;

    Ok(())
}
