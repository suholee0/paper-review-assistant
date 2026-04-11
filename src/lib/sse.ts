export function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
