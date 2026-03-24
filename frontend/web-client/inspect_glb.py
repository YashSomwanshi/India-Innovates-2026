import json
import sys

def extract_glb_json(filepath):
    print(f"Reading {filepath}...")
    try:
        with open(filepath, 'rb') as f:
            # Read the 12-byte header
            header = f.read(12)
            if len(header) < 12:
                print("File too short")
                return
                
            magic, version, length = __import__('struct').unpack('<4sII', header)
            
            if magic != b'glTF':
                print(f"Not a valid GLB file. Magic bytes: {magic}")
                return
                
            print(f"GLB Version: {version}, Total Length: {length}")
            
            # Read Chunk 0 (JSON)
            chunk0_header = f.read(8)
            chunk0_length, chunk0_type = __import__('struct').unpack('<I4s', chunk0_header)
            
            if chunk0_type != b'JSON':
                print(f"First chunk is not JSON, it is {chunk0_type}")
                return
                
            json_data = f.read(chunk0_length)
            gltf = json.loads(json_data.decode('utf-8'))
            
            print("\n=== Morph Targets Found ===")
            found_targets = False
            
            if 'meshes' in gltf:
                for i, mesh in enumerate(gltf['meshes']):
                    name = mesh.get('name', f'unnamed_{i}')
                    
                    if 'primitives' in mesh:
                        for j, prim in enumerate(mesh['primitives']):
                            if 'targets' in prim:
                                found_targets = True
                                # GLTF stores morph target names in mesh.extras.targetNames
                                names = mesh.get('extras', {}).get('targetNames', [])
                                if names:
                                    print(f"Mesh '{name}': {len(names)} targets -> {', '.join(names)}")
                                else:
                                    print(f"Mesh '{name}': {len(prim['targets'])} targets (Names missing in extras)")
                                    
            if not found_targets:
                print("No morph targets found in any meshes.")
                
            print("\n=== Animations ===")
            if 'animations' in gltf:
                for i, anim in enumerate(gltf['animations']):
                    name = anim.get('name', f'unnamed_{i}')
                    print(f"Animation: '{name}'")
            else:
                print("No animations found.")
                
    except Exception as e:
        print(f"Error reading GLB: {e}")

if __name__ == '__main__':
    extract_glb_json(sys.argv[1] if len(sys.argv) > 1 else 'public/models/avatar_realtime.glb')
