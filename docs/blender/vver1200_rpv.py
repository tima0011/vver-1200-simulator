# VVER-1200 (V-491) reactor pressure vessel — low/mid-poly, real scale (1 unit = 1 m).
# Blender 4.1+ (tested on 5.2). Run in Text Editor or via `blender --python vver1200_rpv.py`.
import bpy, bmesh, math
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- parameters
SEG          = 64      # radial segments of the vessel
R_SHELL      = 2.32    # cylindrical shell outer radius
H_BOTTOM     = 1.80    # elliptical bottom head height
H_CYL        = 8.50    # cylindrical part height
R_NOZ_BAND   = 2.55    # thickened nozzle / support band
Z_NOZ        = 8.90    # nozzle axis height
R_NOZ        = 0.50    # Du-850 nozzle outer radius
R_NOZ_BORE   = 0.425   # Du-850 bore
NOZ_LEN      = 1.20    # nozzle projection beyond the band surface
R_FLANGE     = 2.75    # main joint flange radius
N_STUDS      = 54
R_STUDS      = 2.60
SMOOTH_ANGLE = math.radians(32)
R_INNER      = 2.125   # vessel bore (ID 4.25 m), wall ~0.2 m
Z_LEDGE      = 10.15   # inner ledge carrying the core barrel flange
R_LEDGE      = 2.20
CORE_PITCH   = 0.236   # TVS-2M lattice pitch

Z_CYL_TOP = H_BOTTOM + H_CYL          # 10.30 — main joint plane


def core_lattice():
    """163 FA positions: 15-row hexagon (rings 0..7) without the 6 corners.
    Returns [(x, y, ring)]; rows are parallel to X, hexes are pointy-top."""
    out = []
    for q in range(-7, 8):
        for r in range(-7, 8):
            ring = max(abs(q), abs(r), abs(q + r))
            if ring > 7 or (ring == 7 and 0 in (q, r, q + r)):
                continue
            out.append((CORE_PITCH * (q + r / 2), CORE_PITCH * r * math.sqrt(3) / 2, ring))
    return out


CORE = core_lattice()
CPS = [(x, y) for x, y, ring in CORE if ring not in (1, 7)]   # 121 control rods, 60° symmetric
assert len(CORE) == 163 and len(CPS) == 121

# ---------------------------------------------------------------- scene cleanup
for o in list(bpy.data.objects):
    if o.type in {'MESH', 'CAMERA', 'EMPTY'}:
        bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.cameras, bpy.data.materials):
    for d in list(coll):
        if d.users == 0:
            coll.remove(d)


# ---------------------------------------------------------------- helpers
def lathe(bm, profile, segs, mat=Matrix.Identity(4), closed=False, phase=None):
    """Revolve a (r, z) profile around Z into a closed shell. r == 0 makes a pole;
    closed=True joins the last ring back to the first (annular / tube sections).
    phase: angular offset; the default half-step keeps small operands' vertices off the
    lattice directions (0°/60°/90°…) where big discs have fan edges — exact-boolean degeneracy."""
    if phase is None:
        phase = math.pi / segs
    rings = []
    for r, z in profile:
        if r < 1e-9:
            ring = [bm.verts.new(mat @ Vector((0, 0, z)))]
        else:
            ring = [bm.verts.new(mat @ Vector((r * math.cos(phase + 2 * math.pi * j / segs),
                                                r * math.sin(phase + 2 * math.pi * j / segs), z)))
                    for j in range(segs)]
        rings.append(ring)
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, b in pairs:
        for j in range(segs):
            k = (j + 1) % segs
            if len(a) == 1:
                bm.faces.new((a[0], b[k], b[j]))
            elif len(b) == 1:
                bm.faces.new((a[j], a[k], b[0]))
            else:
                bm.faces.new((a[j], a[k], b[k], b[j]))


def box(bm, size, mat):
    res = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, verts=res['verts'],
                        matrix=mat @ Matrix.Diagonal((*size, 1.0)))


def to_object(bm, name, coll):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


scene = bpy.context.scene
tmp = bpy.data.collections.new("RPV_tmp")
scene.collection.children.link(tmp)

# ---------------------------------------------------------------- 1. vessel + upper head (one lathe)
N = 20
prof = [(0.0, 0.0)]
for k in range(1, N + 1):                       # elliptical bottom, tangent-continuous with the shell
    t = k / N * math.pi / 2
    prof.append((R_SHELL * math.sin(t), H_BOTTOM * (1 - math.cos(t))))
prof += [
    (R_SHELL, 4.5),                             # extra ring to keep shell quads tidy
    (R_SHELL, 7.60),
    (R_NOZ_BAND, 7.90),                         # 45° chamfer into the nozzle / support band
    (R_NOZ_BAND, 9.85),
    (R_FLANGE, 9.95),                           # vessel main flange
    (R_FLANGE, Z_CYL_TOP - 0.02),
    (R_FLANGE - 0.05, Z_CYL_TOP - 0.01),        # main joint groove
    (R_FLANGE - 0.05, Z_CYL_TOP + 0.01),
    (R_FLANGE, Z_CYL_TOP + 0.02),
    (R_FLANGE, 10.65),                          # head flange
]
R_DOME, H_DOME, Z_DOME = 2.45, 1.70, 10.65
for k in range(0, N):                           # spherical-elliptical upper head
    t = k / N * math.pi / 2
    prof.append((R_DOME * math.cos(t), Z_DOME + H_DOME * math.sin(t)))
prof.append((0.0, Z_DOME + H_DOME))

bm = bmesh.new()
lathe(bm, prof, SEG)
rpv = to_object(bm, "RPV_Vessel", scene.collection)

# ---------------------------------------------------------------- 2. union set A: nozzles, CPS upper unit, studs
bmA = bmesh.new()
noz_angles = [i * math.pi / 4 for i in range(8)]
r_root = 2.00                                    # nozzle root buried inside the band
r_tip = R_NOZ_BAND + NOZ_LEN                     # 3.75
noz_prof = [(0, r_root), (0.62, r_root), (0.62, R_NOZ_BAND), (R_NOZ, R_NOZ_BAND + 0.35),
            (R_NOZ, r_tip - 0.06), (R_NOZ + 0.03, r_tip - 0.03), (R_NOZ + 0.03, r_tip), (0, r_tip)]
for a in noz_angles:
    m = Matrix.Translation((0, 0, Z_NOZ)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y')
    lathe(bmA, noz_prof, 32, m)

# CPS drives upper unit (ШЭМ-3): adapter ring → cone → ribbed shroud → top flange → cover
cps_prof = [(0, 11.30), (1.95, 11.30), (1.95, 12.00), (1.75, 12.30), (1.70, 12.40),
            (1.70, 15.60), (1.85, 15.60), (1.85, 15.80), (1.55, 16.20), (0, 16.20)]
lathe(bmA, cps_prof, 48)

stud_prof = [(0, 10.55), (0.13, 10.55), (0.13, 10.80), (0.085, 10.80),
             (0.085, 10.95), (0.055, 10.98), (0, 10.98)]
for i in range(N_STUDS):
    a = 2 * math.pi * (i + 0.5) / N_STUDS
    lathe(bmA, stud_prof, 8, Matrix.Translation((R_STUDS * math.cos(a), R_STUDS * math.sin(a), 0)))
opsA = to_object(bmA, "ops_A", tmp)

# ---------------------------------------------------------------- 3. union set B: shroud ribs, drive housings
bmB = bmesh.new()
for i in range(16):
    a = 2 * math.pi * i / 16
    m = Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((1.785, 0, (12.45 + 15.65) / 2))
    box(bmB, (0.27, 0.08, 15.65 - 12.45), m)

tube_prof = [(0, 16.10), (0.065, 16.10), (0.065, 16.65), (0.05, 16.72), (0, 16.72)]
for x, y in CPS:                                 # 121 CPS drives, coaxial with the core lattice
    lathe(bmB, tube_prof, 12, Matrix.Translation((x, y, 0)))
opsB = to_object(bmB, "ops_B", tmp)

# ---------------------------------------------------------------- 4. difference sets: inner cavity, nozzle bores
cav = [(0.0, H_BOTTOM - 1.6)]
for k in range(1, N + 1):                        # inner bottom head, wall 0.2 m
    t = k / N * math.pi / 2
    cav.append((R_INNER * math.sin(t), H_BOTTOM - 1.6 * math.cos(t)))
cav += [(R_INNER, 4.5), (R_INNER, Z_LEDGE), (R_LEDGE, Z_LEDGE), (R_LEDGE, Z_DOME)]
for k in range(1, N):                            # inner upper head
    t = k / N * math.pi / 2
    cav.append((R_LEDGE * math.cos(t), Z_DOME + 1.5 * math.sin(t)))
cav.append((0.0, Z_DOME + 1.5))
bmCav = bmesh.new()
lathe(bmCav, cav, SEG)
opsCav = to_object(bmCav, "ops_cavity", tmp)

bmC = bmesh.new()
for a in noz_angles:                             # through-bores opening into the downcomer
    m = Matrix.Translation((0, 0, Z_NOZ)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y')
    lathe(bmC, [(0, 1.95), (R_NOZ_BORE, 1.95), (R_NOZ_BORE, r_tip + 0.1), (0, r_tip + 0.1)], 32, m,
          phase=0.0)                             # off the nozzle's own fan edges
opsC = to_object(bmC, "ops_C", tmp)

# ---------------------------------------------------------------- 5. booleans (exact) → single watertight mesh
for nm, op, ob in (("Union_A", 'UNION', opsA), ("Union_B", 'UNION', opsB),
                   ("Cavity", 'DIFFERENCE', opsCav), ("Bores", 'DIFFERENCE', opsC)):
    md = rpv.modifiers.new(nm, 'BOOLEAN')
    md.operation, md.object, md.solver = op, ob, 'EXACT'

bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = rpv
rpv.select_set(True)
for md in list(rpv.modifiers):
    bpy.ops.object.modifier_apply(modifier=md.name)

for ob in list(tmp.objects):
    me = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
bpy.data.collections.remove(tmp)

# ---------------------------------------------------------------- 6. cleanup, hot/cold vertex groups, shading
bm = bmesh.new()
bm.from_mesh(rpv.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(rpv.data)
bm.free()

hot = rpv.vertex_groups.new(name="Nozzles_Hot")
cold = rpv.vertex_groups.new(name="Nozzles_Cold")
for v in rpv.data.vertices:
    x, y, z = v.co
    r = math.hypot(x, y)
    if r > R_NOZ_BAND + 0.005 and abs(z - Z_NOZ) < 0.7:
        idx = round(math.atan2(y, x) / (math.pi / 4)) % 8
        (hot if idx % 2 == 0 else cold).add([v.index], 1.0, 'REPLACE')

bpy.ops.object.shade_smooth_by_angle(angle=SMOOTH_ANGLE, keep_sharp_edges=True)

# Origin = lowest point of the bottom head (already at world 0,0,0)
lo = min(v.co.z for v in rpv.data.vertices)
rpv.data.transform(Matrix.Translation((0, 0, -lo)))
rpv.location = (0, 0, 0)

# ---------------------------------------------------------------- 7. PBR material
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

mat = bpy.data.materials.get("MAT_Reactor_Steel") or bpy.data.materials.new("MAT_Reactor_Steel")
mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
hexcol = "3b4252"
bsdf.inputs["Base Color"].default_value = (*[srgb_to_lin(int(hexcol[i:i + 2], 16) / 255) for i in (0, 2, 4)], 1.0)
bsdf.inputs["Metallic"].default_value = 0.85
bsdf.inputs["Roughness"].default_value = 0.35
mat.diffuse_color = (0x3b / 255, 0x42 / 255, 0x52 / 255, 1.0)
mat.metallic, mat.roughness = 0.85, 0.35
rpv.data.materials.clear()
rpv.data.materials.append(mat)

# ---------------------------------------------------------------- report
bm = bmesh.new()
bm.from_mesh(rpv.data)
non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
boundary = sum(1 for e in bm.edges if e.is_boundary)
bm.free()
xs = [v.co for v in rpv.data.vertices]
result = {
    "object": rpv.name,
    "verts": len(rpv.data.vertices), "faces": len(rpv.data.polygons),
    "non_manifold_edges": non_manifold, "boundary_edges": boundary,
    "z_range": (round(min(c.z for c in xs), 4), round(max(c.z for c in xs), 4)),
    "max_radius": round(max(math.hypot(c.x, c.y) for c in xs), 4),
    "hot_verts": sum(1 for v in rpv.data.vertices if any(g.group == hot.index for g in v.groups)),
    "cold_verts": sum(1 for v in rpv.data.vertices if any(g.group == cold.index for g in v.groups)),
    "objects": [o.name for o in bpy.data.objects],
}
print(result)
