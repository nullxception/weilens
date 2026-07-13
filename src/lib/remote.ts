import type { PicInfo } from "@/types/remote";

export function getPreferredImage(info: PicInfo) {
  const pic = info?.largest ?? info?.mw2000 ?? info?.original ?? info?.large;
  const thumb = info?.largecover ?? info?.bmiddle ?? info?.thumbnail;
  const thumbSize = thumb?.url?.split("/")[3] ?? "";
  return {
    preferred: {
      url: pic?.url,
      width: pic?.width,
      height: pic?.height,
    },
    thumb: {
      url: thumb?.url?.replace("/" + thumbSize + "/", "/orj360/") ?? "",
      width: thumb?.width,
      height: thumb?.height,
    },
    videoUrl: info?.type === "livephoto" && info?.video ? info?.video : null,
  };
}
