export function getNoWatermarkUrl(picUrl: string): string {
  let picSize = picUrl.split("/")[3];
  return picUrl.replace("/" + picSize + "/", "/oslarge/");
}
