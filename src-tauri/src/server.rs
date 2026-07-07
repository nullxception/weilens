use std::thread;
use tiny_http::{Header, Response, Server};
use url::Url;

pub fn start_proxy_server() {
    let server = Server::http("localhost:18327").unwrap();

    thread::spawn(move || {
        for request in server.incoming_requests() {
            let url_string = format!("http://localhost:18327{}", request.url());

            if let Ok(parsed_url) = Url::parse(&url_string) {
                let target_url = parsed_url
                    .query_pairs()
                    .find(|(key, _)| key == "url")
                    .map(|(_, value)| value.into_owned());

                if let Some(img_url) = target_url {
                    if let Ok(res) = reqwest::blocking::get(&img_url) {
                        let content_type = res
                            .headers()
                            .get("content-type")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or("image/jpeg")
                            .to_string();

                        if let Ok(bytes) = res.bytes() {
                            let mut response =
                                Response::from_data(bytes.to_vec()).with_status_code(200);

                            response.add_header(
                                Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes())
                                    .unwrap(),
                            );
                            response.add_header(
                                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..])
                                    .unwrap(),
                            );
                            response.add_header(
                                Header::from_bytes(
                                    &b"Cache-Control"[..],
                                    &b"public, max-age=31536000"[..],
                                )
                                .unwrap(),
                            );

                            let _ = request.respond(response);
                            continue;
                        }
                    }
                }
            }

            let fallback = Response::from_string("Bad Request").with_status_code(400);
            let _ = request.respond(fallback);
        }
    });
}
