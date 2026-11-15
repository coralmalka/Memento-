import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Canvas, Image as SkiaImage, Skia, ImageFormat, useImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { colorMatrix, DEFAULT_EDITS, FILTERS, outputSize } from '../lib/storyEdits';

function renderPhoto(image, edits, maxSide) {
  const size = outputSize(image.width(),image.height(),edits.rotation,maxSide);
  // Raster surfaces are safe for export without an onscreen GPU snapshot.
  const surface = Skia.Surface.Make(size.width,size.height);
  if(!surface) throw Error('Could not prepare the photo editor. Try a smaller image.');
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(colorMatrix(edits)));
  canvas.translate(size.width/2,size.height/2);
  canvas.rotate(edits.rotation,0,0);
  canvas.scale(edits.flip ? -1 : 1,1);
  canvas.drawImageRect(image,Skia.XYWHRect(0,0,image.width(),image.height()),
    Skia.XYWHRect(-size.sourceWidth/2,-size.sourceHeight/2,size.sourceWidth,size.sourceHeight),paint);
  surface.flush();
  const result = surface.makeImageSnapshot();
  surface.dispose();
  paint.dispose();
  return result;
}

export default forwardRef(function StoryPhotoEditor({ uri, edits, onChange, disabled }, ref) {
  const [tool,setTool]=useState('filters');
  const [width,setWidth]=useState(320);
  const [imageError,setImageError]=useState(false);
  const image=useImage(uri,()=>setImageError(true));
  const preview=useMemo(()=>{
    if(!image) return null;
    try { return renderPhoto(image,edits,1200); } catch { return null; }
  },[image,edits]);
  // Skia objects are disposed when replaced, not while React is displaying them.
  React.useEffect(()=>()=>{preview?.dispose();},[preview]);
  const set=(key,value)=>onChange({...edits,[key]:value});
  useImperativeHandle(ref,()=>({
    async exportImage() {
      if(!image || !preview) throw Error('Wait for the photo to load, or choose it again.');
      const exported=renderPhoto(image,edits,4096);
      try {
        const bytes=await exported.encodeToBytes(ImageFormat.JPEG,94);
        if(!bytes?.length) throw Error('Could not save your edits. Please try again.');
        const file=new File(Paths.cache,`memento-story-${Date.now()}.jpg`);
        file.write(bytes);
        return file;
      } finally { exported.dispose(); }
    }
  }),[image,preview,edits]);
  const height=preview?width*preview.height()/preview.width():350;
  return <View pointerEvents={disabled?'none':'auto'}>
    <View onLayout={e=>setWidth(e.nativeEvent.layout.width)} style={{height:Math.min(height,520),backgroundColor:'#101218'}}>
      {preview ? <Canvas style={{flex:1}}><SkiaImage image={preview} x={0} y={0} width={width} height={Math.min(height,520)} fit="contain"/></Canvas>
        : <View style={s.loading}>{imageError || image ? <Text style={{color:'#fff'}}>Cannot open this photo. Choose another photo.</Text> : <ActivityIndicator color="#fff"/>}</View>}
    </View>
    <View style={s.tools}>
      {[['filters','color-filter-outline','Filters'],['adjust','options-outline','Adjust']].map(([id,icon,label])=><TouchableOpacity key={id} accessibilityRole="button" accessibilityState={{selected:tool===id}} onPress={()=>setTool(id)} style={[s.tool,tool===id&&s.active]}><Ionicons name={icon} size={23} color="#313647"/><Text>{label}</Text></TouchableOpacity>)}
      <TouchableOpacity accessibilityLabel="Rotate photo 90 degrees" onPress={()=>set('rotation',(edits.rotation+90)%360)} style={s.tool}><Ionicons name="refresh-outline" size={23}/><Text>Rotate</Text></TouchableOpacity>
      <TouchableOpacity accessibilityLabel="Flip photo horizontally" onPress={()=>set('flip',!edits.flip)} style={[s.tool,edits.flip&&s.active]}><Ionicons name="swap-horizontal-outline" size={23}/><Text>Flip</Text></TouchableOpacity>
    </View>
    {tool==='filters' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{FILTERS.map(f=><TouchableOpacity key={f.id} accessibilityRole="button" accessibilityLabel={`${f.label} filter`} accessibilityState={{selected:edits.filter===f.id}} onPress={()=>set('filter',f.id)} style={[s.filter,edits.filter===f.id&&s.selected]}><Ionicons name={f.icon} size={27} color={edits.filter===f.id?'#fff':'#42475A'}/><Text style={{color:edits.filter===f.id?'#fff':'#42475A',fontSize:12}}>{f.label}</Text></TouchableOpacity>)}</ScrollView>
      : <View style={s.adjust}>{[['brightness','Brightness',-.3,.3],['contrast','Contrast',.6,1.6],['saturation','Saturation',0,2]].map(([key,label,min,max])=><View key={key}><Text>{label}</Text><Slider accessibilityLabel={label} value={edits[key]} minimumValue={min} maximumValue={max} step={.01} onValueChange={value=>set(key,value)} minimumTrackTintColor="#6657C7"/></View>)}</View>}
    <TouchableOpacity onPress={()=>onChange({...DEFAULT_EDITS})} style={s.reset}><Ionicons name="arrow-undo-outline" size={17}/><Text>Reset edits</Text></TouchableOpacity>
  </View>;
});
const s=StyleSheet.create({loading:{flex:1,alignItems:'center',justifyContent:'center'},tools:{flexDirection:'row',justifyContent:'space-around',padding:12,gap:5},tool:{alignItems:'center',gap:6,padding:9,borderRadius:12},active:{backgroundColor:'#EBE8FF'},filters:{paddingHorizontal:16,gap:10,paddingBottom:8},filter:{width:76,height:82,borderRadius:16,backgroundColor:'#F0F1F5',alignItems:'center',justifyContent:'center',gap:8},selected:{backgroundColor:'#53459C'},adjust:{paddingHorizontal:24,gap:12},reset:{flexDirection:'row',gap:7,alignItems:'center',alignSelf:'center',padding:14}});
