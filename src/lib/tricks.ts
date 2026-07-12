export function getNoWatermarkUrl(picUrl: string): string {
  const picSize = picUrl.split("/")[3];
  return picUrl.replace("/" + picSize + "/", "/oslarge/");
}
