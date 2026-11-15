// Shared, normalized RGBA matrices for preview and exported photos (offsets 0..1).
export const FILTERS = [
  { id: 'original', label: 'Original', icon: 'aperture-outline', tint: [1,1,1], saturation: 1 },
  { id: 'chrome', label: 'Chrome', icon: 'diamond-outline', tint: [.93,1,1.12], saturation: .8 },
  { id: 'golden', label: 'Golden', icon: 'sunny-outline', tint: [1.12,1.03,.85], saturation: 1.1 },
  { id: 'rose', label: 'Rose', icon: 'rose-outline', tint: [1.12,.93,1.06], saturation: .9 },
  { id: 'noir', label: 'Noir', icon: 'moon-outline', tint: [1,1,1], saturation: 0 },
  { id: 'vivid', label: 'Vivid', icon: 'color-wand-outline', tint: [1.03,1,1.04], saturation: 1.45 },
];
export const DEFAULT_EDITS = { filter: 'original', brightness: 0, contrast: 1, saturation: 1, rotation: 0, flip: false };
export function colorMatrix(edits) {
  const preset = FILTERS.find(f => f.id === edits.filter) || FILTERS[0];
  const sat = preset.saturation * edits.saturation;
  const weights = [.2126,.7152,.0722];
  const offset = .5 * (1-edits.contrast) + edits.brightness;
  const matrix = [];
  for(let row=0;row<3;row++) {
    for(let col=0;col<3;col++) matrix.push((weights[col]*(1-sat)+(row===col?sat:0))*edits.contrast*preset.tint[row]);
    matrix.push(0, offset);
  }
  return [...matrix,0,0,0,1,0];
}
export function outputSize(width, height, rotation, maxSide=4096) {
  const scale = Math.min(1,maxSide/Math.max(width,height));
  const w = Math.max(1,Math.round(width*scale)), h = Math.max(1,Math.round(height*scale));
  return rotation % 180 ? {width:h,height:w,sourceWidth:w,sourceHeight:h} : {width:w,height:h,sourceWidth:w,sourceHeight:h};
}
