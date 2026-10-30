import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {load} from './helpers/load-module.mjs';
const three=createRequire(import.meta.url)('three');
const {HEART_PARTS}=load('lib/heart-parts.ts');
const {vesselKind,vesselHighlightColor,VESSEL_HIGHLIGHT_COLORS,VESSEL_HIGHLIGHT_OPACITY}=load('lib/vessel-highlight.ts');
const {prepareImportedModel}=load('lib/imported-model.ts',{three});
test('all 17 canonical structures have explicit arterial or venous highlight colours',()=>{
 assert.equal(HEART_PARTS.length,17);
 for(const part of HEART_PARTS){const expected=['superior-vena-cava','coronary-sinus'].includes(part.id)?'vein':'artery';assert.equal(vesselKind(part.id),expected);assert.equal(vesselHighlightColor([part.id]),VESSEL_HIGHLIGHT_COLORS[expected]);}
 assert.equal(vesselHighlightColor(['right-coronary-proximal','right-coronary-middle','right-coronary-distal']),VESSEL_HIGHLIGHT_COLORS.artery);
 assert.equal(vesselHighlightColor(['ascending-aorta','superior-vena-cava']),undefined);assert.equal(vesselHighlightColor([]),undefined);
 assert.notEqual(VESSEL_HIGHLIGHT_COLORS.artery,'#fb7185');assert.notEqual(VESSEL_HIGHLIGHT_COLORS.vein,'#fb7185');
});
test('hover, selection and isolation preserve textures and restore each material for arteries and veins',()=>{
 assert.equal(VESSEL_HIGHLIGHT_OPACITY,.7);
 const root=new three.Group(),texture=new three.Texture(),shared=new three.MeshStandardMaterial({color:'#bfa098',map:texture,roughness:.79});
 const structures={},meshes=HEART_PARTS.map((p,i)=>{const mesh=new three.Mesh(new three.BoxGeometry(1,1,1),shared);mesh.name=p.id;mesh.position.x=i;root.add(mesh);structures[p.id]={meshes:[p.id]};return mesh;});
 const ready=prepareImportedModel(root,{version:1,url:'/models/test.glb',rotationDegrees:[0,0,0],structures});
 for(const [i,part] of HEART_PARTS.entries())for(const selected of [false,true]){
  ready.applySelection(selected?part.id:null,selected?null:part.id,null);
  const expected=new three.Color('#bfa098').lerp(new three.Color(vesselHighlightColor([part.id])),.7);
  assert.equal(meshes[i].material.color.getHexString(),expected.getHexString());
  assert.equal(meshes[i].material.emissive.getHexString(),vesselHighlightColor([part.id]).slice(1));
  assert.equal(meshes[i].material.emissiveIntensity,(selected?.22:.12)*.7);
  assert.equal(meshes[i].material.opacity,1);assert.equal(meshes[i].material.transparent,false);
  ready.applySelection(selected?part.id:null,selected?null:part.id,null);
  assert.equal(meshes[i].material.color.getHexString(),expected.getHexString(),'Repeated highlighting does not accumulate tint');
  for(const [n,mesh] of meshes.entries()){assert.equal(mesh.material.map,texture);assert.equal(mesh.material.roughness,.79);if(n!==i)assert.equal(mesh.material.color.getHexString(),'bfa098');}
  ready.applySelection(part.id,part.id,part.id);assert.equal(meshes[i].material.color.getHexString(),'bfa098');assert.equal(meshes[i].material.opacity,1);assert.equal(meshes[(i+1)%17].material.opacity,.2);
  ready.applySelection(null,null,null);assert.ok(meshes.every(m=>m.material.color.getHexString()==='bfa098'&&m.material.opacity===1));
 }
 assert.equal(shared.color.getHexString(),'bfa098');assert.equal(shared.emissive.getHexString(),'000000');ready.dispose();
});
