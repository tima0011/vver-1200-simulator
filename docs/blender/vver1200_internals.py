# VVER-1200 (V-491) reactor internals — builds on vver1200_rpv.py (run this file; it runs the vessel first).
# Objects (children of the empty "VVER1200_RPV"):
#   RPV_Vessel, RPV_Core_Barrel, RPV_Core_Shroud, RPV_Core_Assemblies, RPV_BZT
import bpy, bmesh, math, os
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else bpy.path.abspath("//")
_vessel = os.path.join(HERE, "vver1200_rpv.py")
exec(compile(open(_vessel, encoding="utf-8").read(), _vessel, "exec"), globals())
# from the vessel script: lathe, box, to_object, CORE, CPS, srgb_to_lin, SEG, N, Z_LEDGE, Z_NOZ, SMOOTH_ANGLE, rpv, scene

vessel = rpv
CPS_SET = {(round(x, 4), round(y, 4)) for x, y in CPS}
is_cps = lambda x, y: (round(x, 4), round(y, 4)) in CPS_SET

# ---------------------------------------------------------------- parameters
R_BAR_OUT, R_BAR_IN = 1.85, 1.79   # core barrel
Z_BAR_BOT = 2.40                   # lowest point of the barrel bottom
Z_BAR_EQ  = 3.20                   # bottom head → cylinder transition
R_BAR_FL  = 2.19                   # barrel flange, sits on the vessel ledge (R 2.20, Z 10.15)
Z_JOINT   = 10.30
R_SHROUD  = 1.77                   # shroud outer radius
Z_SHR     = (3.20, 7.20)
Z_FA      = (3.30, 7.50)           # TVS-2M: 3.73 m fuel + end pieces
FA_FLAT   = 0.234
Z_BZT     = (7.51, 11.50)

tmp = bpy.data.collections.new("RPV_tmp")
scene.collection.children.link(tmp)


def operand(name, build):
    bm = bmesh.new()
    build(bm)
    return to_object(bm, name, tmp)


def boolean_chain(ob, steps):
    """steps: [(operation, operand_object)] applied in order with the exact solver."""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    for i, (op, opnd) in enumerate(steps):
        md = ob.modifiers.new(f"bool_{i}", 'BOOLEAN')
        md.operation, md.object, md.solver = op, opnd, 'EXACT'
        bpy.ops.object.modifier_apply(modifier=md.name)


def finish(ob, mat):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=SMOOTH_ANGLE, keep_sharp_edges=True)
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def make_mat(name, hexcol, metallic, roughness):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    srgb = [int(hexcol[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    bsdf.inputs["Base Color"].default_value = (*[srgb_to_lin(c) for c in srgb], 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = (*srgb, 1.0)
    mat.metallic, mat.roughness = metallic, roughness
    return mat


def radial(a, z=0.0):
    """Matrix taking the local +Z axis to the horizontal radial direction at angle a."""
    return Matrix.Translation((0, 0, z)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y')


MAT_INT  = make_mat("MAT_Internals_Steel", "5c6370", 0.80, 0.30)   # 08Х18Н10Т
MAT_FUEL = make_mat("MAT_Zirconium_Fuel",  "d4af37", 0.85, 0.25)
MAT_BZT  = make_mat("MAT_BZT_Steel",       "616e88", 0.75, 0.40)

# ================================================================ 1. RPV_Core_Barrel
def ell(a, c, t):
    return a * math.sin(t), Z_BAR_EQ - c * math.cos(t)

C_OUT, C_IN = Z_BAR_EQ - Z_BAR_BOT, Z_BAR_EQ - Z_BAR_BOT - 0.06
prof = [(0.0, Z_BAR_BOT)]
prof += [ell(R_BAR_OUT, C_OUT, k / N * math.pi / 2) for k in range(1, N + 1)]
prof += [(R_BAR_OUT, 6.0), (R_BAR_OUT, Z_LEDGE), (R_BAR_FL, Z_LEDGE), (R_BAR_FL, Z_JOINT),
         (R_BAR_IN, Z_JOINT), (R_BAR_IN, 6.0)]
prof += [ell(R_BAR_IN, C_IN, k / N * math.pi / 2) for k in range(N, 0, -1)]
prof.append((0.0, Z_BAR_EQ - C_IN))
bm = bmesh.new()
lathe(bm, prof, SEG)
barrel = to_object(bm, "RPV_Core_Barrel", scene.collection)

z_out = lambda r: Z_BAR_EQ - C_OUT * math.sqrt(max(0.0, 1 - (r / R_BAR_OUT) ** 2))

def _windows_and_holes(bm):
    for i in range(4):                       # windows facing the hot-leg nozzles (0°, 90°, 180°, 270°)
        lathe(bm, [(0, 1.70), (0.425, 1.70), (0.425, 1.95), (0, 1.95)], 32, radial(i * math.pi / 2, Z_NOZ))
    for x, y, _ in CORE:                     # flow holes in the elliptical bottom
        lathe(bm, [(0, 2.30), (0.045, 2.30), (0.045, 3.00), (0, 3.00)], 12, Matrix.Translation((x, y, 0)))

def _ring_and_tubes(bm):
    lathe(bm, [(1.68, 3.10), (1.80, 3.10), (1.80, 3.20), (1.68, 3.20)], SEG, closed=True)   # shroud seat
    for x, y, _ in CORE:                     # hollow FA support tubes
        z0 = z_out(math.hypot(x, y) + 0.065) + 0.005
        lathe(bm, [(0.05, z0), (0.065, z0), (0.065, Z_FA[0] - 0.01), (0.05, Z_FA[0] - 0.01)], 12,
              Matrix.Translation((x, y, 0)), closed=True)

boolean_chain(barrel, [('DIFFERENCE', operand("ops_bar_holes", _windows_and_holes)),
                       ('UNION', operand("ops_bar_tubes", _ring_and_tubes))])
finish(barrel, MAT_INT)

# ================================================================ 2. RPV_Core_Shroud
# Faceted inner contour = outer boundary of the 163-cell hexagonal tiling (cell = pitch 0.236)
Rc = CORE_PITCH / math.sqrt(3)
edge_count = {}
for x, y, _ in CORE:
    pts = [(round(x + Rc * math.cos(math.radians(30 + 60 * k)), 4),
            round(y + Rc * math.sin(math.radians(30 + 60 * k)), 4)) for k in range(6)]
    for k in range(6):
        e = frozenset((pts[k], pts[(k + 1) % 6]))
        edge_count[e] = edge_count.get(e, 0) + 1
adj = {}
for e, n in edge_count.items():
    if n == 1:
        a, b = tuple(e)
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
assert all(len(v) == 2 for v in adj.values())
loop = [next(iter(adj))]
prev = None
while True:
    nxt = [p for p in adj[loop[-1]] if p != prev][0]
    if nxt == loop[0]:
        break
    prev = loop[-1]
    loop.append(nxt)

def _core_prism(bm):
    lo = [bm.verts.new((x, y, Z_SHR[0] - 0.1)) for x, y in loop]
    hi = [bm.verts.new((x, y, Z_SHR[1] + 0.1)) for x, y in loop]
    bm.faces.new(lo)
    bm.faces.new(hi)
    for i in range(len(loop)):
        j = (i + 1) % len(loop)
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))

bm = bmesh.new()
lathe(bm, [(0, Z_SHR[0]), (R_SHROUD, Z_SHR[0]), (R_SHROUD, Z_SHR[1]), (0, Z_SHR[1])], SEG)
shroud = to_object(bm, "RPV_Core_Shroud", scene.collection)
boolean_chain(shroud, [('DIFFERENCE', operand("ops_core_prism", _core_prism))])
finish(shroud, MAT_INT)

# ================================================================ 3. RPV_Core_Assemblies (one mesh, 163 TVS-2M)
Rf = FA_FLAT / math.sqrt(3)                  # circumradius of the 234 mm hexagon
fa_prof = [(0, Z_FA[0]), (0.105, Z_FA[0]), (0.105, 3.45), (Rf, 3.52), (Rf, 7.25),
           (0.125, 7.30), (0.125, Z_FA[1]), (0, Z_FA[1])]
bm = bmesh.new()
for x, y, _ in CORE:
    lathe(bm, fa_prof, 6, Matrix.Translation((x, y, 0)), phase=math.pi / 6)   # pointy-top, flats face neighbours
core = to_object(bm, "RPV_Core_Assemblies", scene.collection)
finish(core, MAT_FUEL)

# ================================================================ 4. RPV_BZT (protective tube unit)
def _plates(bm):
    lathe(bm, [(0, Z_BZT[0]), (1.76, Z_BZT[0]), (1.76, 7.76), (0, 7.76)], SEG)        # support plate
    lathe(bm, [(0, 9.20), (1.76, 9.20), (1.76, 9.30), (0, 9.30)], SEG)                 # perforated grid
    lathe(bm, [(0, 11.30), (1.70, 11.30), (1.70, Z_BZT[1]), (0, Z_BZT[1])], SEG)       # upper plate
    lathe(bm, [(1.55, Z_JOINT), (2.15, Z_JOINT), (2.15, 10.42), (1.55, 10.42)], SEG, closed=True)  # flange

def _bzt_holes(bm):
    for x, y, _ in CORE:
        T = Matrix.Translation((x, y, 0))
        if is_cps(x, y):
            lathe(bm, [(0, 7.40), (0.05, 7.40), (0.05, 7.90), (0, 7.90)], 12, T)       # rod passage
            lathe(bm, [(0, 9.00), (0.08, 9.00), (0.08, 11.6), (0, 11.6)], 12, T)       # tube passages
        else:
            lathe(bm, [(0, 7.40), (0.08, 7.40), (0.08, 11.6), (0, 11.6)], 12, T)       # coolant holes

def _columns(bm):
    for k in range(6):
        a = math.radians(30 + 60 * k)
        lathe(bm, [(0, 7.60), (0.07, 7.60), (0.07, 11.40), (0, 11.40)], 16,
              Matrix.Translation((1.62 * math.cos(a), 1.62 * math.sin(a), 0)))

def _guide_tubes(bm):
    for x, y in CPS:
        lathe(bm, [(0.055, 7.70), (0.07, 7.70), (0.07, Z_BZT[1]), (0.055, Z_BZT[1])], 12,
              Matrix.Translation((x, y, 0)), closed=True)

bm = bmesh.new()
_plates(bm)
bzt = to_object(bm, "RPV_BZT", scene.collection)
boolean_chain(bzt, [('DIFFERENCE', operand("ops_bzt_holes", _bzt_holes)),
                    ('UNION', operand("ops_bzt_cols", _columns)),
                    ('UNION', operand("ops_bzt_tubes", _guide_tubes))])
finish(bzt, MAT_BZT)

# ---------------------------------------------------------------- cleanup operands
for ob in list(tmp.objects):
    me = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
bpy.data.collections.remove(tmp)

# ---------------------------------------------------------------- hierarchy
root = bpy.data.objects.new("VVER1200_RPV", None)
root.empty_display_type, root.empty_display_size = 'PLAIN_AXES', 1.0
scene.collection.objects.link(root)
PARTS = [vessel, barrel, shroud, core, bzt]
for ob in PARTS:
    ob.parent = root
    ob.matrix_parent_inverse = Matrix.Identity(4)

# ---------------------------------------------------------------- report
def stats(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    nm = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    zs = [v.co.z for v in ob.data.vertices]
    rs = [math.hypot(v.co.x, v.co.y) for v in ob.data.vertices]
    return {"verts": len(ob.data.vertices), "faces": len(ob.data.polygons), "non_manifold": nm,
            "z": (round(min(zs), 3), round(max(zs), 3)), "r_max": round(max(rs), 3),
            "material": ob.data.materials[0].name}

result = {"parts": {ob.name: stats(ob) for ob in PARTS},
          "shroud_contour_vertices": len(loop), "fa": len(CORE), "cps": len(CPS),
          "objects": [o.name for o in bpy.data.objects]}
print(result)
