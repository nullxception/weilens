import type { PicDimension, PicInfo } from "@/types/remote";

export function getNoWatermarkUrl(picUrl: string): string {
  const picSize = picUrl.split("/")[3];
  return picUrl.replace("/" + picSize + "/", "/oslarge/");
}

export function getAspectRatio(pdm?: PicDimension): string {
  if (!pdm || !pdm.width || !pdm.height) return "1 / 1";
  return `${pdm.width} / ${pdm.height}`;
}

export function getPreferredImage(info: PicInfo) {
  const pic = info?.largest ?? info?.mw2000 ?? info?.original ?? info?.large;
  const thumb = info?.largecover ?? info?.bmiddle ?? info?.thumbnail;
  return {
    url: pic?.url ?? "",
    thumb: thumb,
    videoUrl: info?.type === "livephoto" && info?.video ? info?.video : null,
  };
}
