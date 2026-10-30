"""Run with Blender --background --factory-startup --disable-autoexec --python.

Creates separate review candidates; never installs a model or changes scan inputs.
The material names and texture paths here describe the supplied RealityScan export.
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--textures', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--targets', default='1250000,500000')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source, textures, output = Path(args.source).resolve(), Path(args.textures).resolve(), Path(args.output).resolve()
if output == source or source in output.parents:
    raise ValueError('Output must be separate from the source scan folder.')
output.mkdir(parents=True, exist_ok=True)

def log(message):
    print(message, flush=True)

def fingerprint(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

original_hashes = {file.name: fingerprint(file) for file in source.iterdir() if file.is_file()}
start = time.monotonic()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
log('Importing original OBJ...')
bpy.ops.wm.obj_import(filepath=str(source / 'Heart_scan.obj'), use_split_objects=True, use_split_groups=False)
originals = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
for obj in originals:
    obj.name = 'Heart_Scan' if len(originals) == 1 else obj.name
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    # The OBJ contains RGB vertex samples as well as diffuse textures. Do not
    # multiply both sources together, which would darken the scan twice.
    for attribute in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attribute)
    for material in obj.data.materials:
        if not material:
            continue
        name = material.name.split('.')[0]
        color_file = textures / f'{name}_diffuse.jpeg'
        normal_file = textures / f'{name}_normal.jpeg'
        if not color_file.exists() or not normal_file.exists():
            raise FileNotFoundError(f'Missing prepared textures for {name}')
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        nodes.clear()
        surface = nodes.new('ShaderNodeBsdfPrincipled')
        surface.inputs['Metallic'].default_value = 0
        surface.inputs['Roughness'].default_value = 0.75
        surface.inputs['Specular IOR Level'].default_value = 0.2
        terminal = nodes.new('ShaderNodeOutputMaterial')
        links.new(surface.outputs['BSDF'], terminal.inputs['Surface'])
        color = nodes.new('ShaderNodeTexImage')
        color.image = bpy.data.images.load(str(color_file), check_existing=True)
        color.image.colorspace_settings.name = 'sRGB'
        links.new(color.outputs['Color'], surface.inputs['Base Color'])
        normal = nodes.new('ShaderNodeTexImage')
        normal.image = bpy.data.images.load(str(normal_file), check_existing=True)
        normal.image.colorspace_settings.name = 'Non-Color'
        convert = nodes.new('ShaderNodeNormalMap')
        convert.space = 'TANGENT'
        links.new(normal.outputs['Color'], convert.inputs['Color'])
        links.new(convert.outputs['Normal'], surface.inputs['Normal'])

for image in list(bpy.data.images):
    if image.users == 0:
        bpy.data.images.remove(image)

triangles = sum(len(obj.data.polygons) for obj in originals)
report = {'source': str(source), 'sourceHashes': original_hashes, 'sourceTriangles': triangles,
          'sourceObjects': len(originals), 'variants': [],
          'notes': ['Original source files are read-only inputs.',
                    'No named anatomical segmentation exists in this OBJ.',
                    'Smooth vertex normals rebuilt because OBJ contains no vn records.',
                    'Normal textures interpreted as tangent-space maps; inspect shading against the source application.',
                    'Source photo colours are used once, not multiplied by vertex colours.',
                    'Geometry and texture reductions need anatomical review before teaching use.']}

def export(objects, filename, target=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = output / filename
    if path.exists():
        raise FileExistsError(f'Refusing to overwrite {path}')
    log(f'Exporting {filename}...')
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_animations=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16, export_draco_normal_quantization=12,
        export_draco_texcoord_quantization=14, export_image_format='AUTO',
        export_vertex_color='NONE', export_materials='EXPORT', export_apply=True)
    faces = sum(len(obj.data.polygons) for obj in objects)
    entry = {'file': filename, 'triangles': faces, 'target': target, 'bytes': path.stat().st_size,
             'sha256': fingerprint(path)}
    report['variants'].append(entry)
    log(json.dumps(entry))
    (output / 'preparation-report.json').write_text(json.dumps(report, indent=2), encoding='utf8')

export(originals, 'heart-scan-full-geometry.glb')
for target in [int(value) for value in args.targets.split(',') if value]:
    copies = []
    for original in originals:
        copy = original.copy()
        copy.data = original.data.copy()
        bpy.context.collection.objects.link(copy)
        copies.append(copy)
        bpy.ops.object.select_all(action='DESELECT')
        copy.select_set(True)
        bpy.context.view_layer.objects.active = copy
        modifier = copy.modifiers.new('Web candidate reduction', 'DECIMATE')
        modifier.decimate_type = 'COLLAPSE'
        modifier.ratio = min(1.0, target / triangles)
        modifier.use_collapse_triangulate = True
        log(f'Reducing a separate copy to approximately {target:,} triangles...')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    export(copies, f'heart-scan-{target // 1000}k.glb', target)
    for copy in copies:
        mesh = copy.data
        bpy.data.objects.remove(copy, do_unlink=True)
        bpy.data.meshes.remove(mesh)
if original_hashes != {file.name: fingerprint(file) for file in source.iterdir() if file.is_file()}:
    raise RuntimeError('Source fingerprint mismatch.')
report['originalsUnchanged'] = True
report['elapsedSeconds'] = round(time.monotonic() - start, 1)
(output / 'preparation-report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
log('Finished; original source hashes are unchanged.')
