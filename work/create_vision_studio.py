from pathlib import Path
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent / "usd-python"))

from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils


OUT = ROOT / "public" / "immersive"
OUT.mkdir(parents=True, exist_ok=True)
USD_PATH = OUT / "vision-studio.usda"
USDZ_PATH = OUT / "vision-studio.usdz"

stage = Usd.Stage.CreateNew(str(USD_PATH))
UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
UsdGeom.SetStageMetersPerUnit(stage, 1.0)
stage.SetDefaultPrim(UsdGeom.Xform.Define(stage, "/VisionStudio").GetPrim())
stage.SetStartTimeCode(0)
stage.SetEndTimeCode(1)

world = UsdGeom.Xform.Define(stage, "/VisionStudio/Architecture")


def material(name, color, roughness=0.45, metallic=0.0, emissive=None):
    mat = UsdShade.Material.Define(stage, f"/VisionStudio/Materials/{name}")
    shader = UsdShade.Shader.Define(stage, f"/VisionStudio/Materials/{name}/Surface")
    shader.CreateIdAttr("UsdPreviewSurface")
    shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*color))
    shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(roughness)
    shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(metallic)
    if emissive:
        shader.CreateInput("emissiveColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*emissive))
    mat.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
    return mat


materials = {
    "floor": material("Limestone", (0.48, 0.53, 0.56), 0.67, 0.08),
    "floor_light": material("PaleLimestone", (0.69, 0.72, 0.72), 0.58, 0.05),
    "wall_a": material("WarmPlaster", (0.73, 0.72, 0.68), 0.72),
    "wall_b": material("CoolPlaster", (0.54, 0.6, 0.64), 0.68),
    "wall_c": material("SoftIvory", (0.82, 0.81, 0.76), 0.76),
    "dark": material("Graphite", (0.085, 0.11, 0.14), 0.34, 0.48),
    "metal": material("SatinTitanium", (0.48, 0.56, 0.61), 0.22, 0.83),
    "glow": material("SoftCyanLight", (0.13, 0.48, 0.52), 0.25, 0.22, (0.055, 0.42, 0.48)),
    "warm_glow": material("SoftWarmLight", (0.58, 0.37, 0.22), 0.28, 0.15, (0.42, 0.17, 0.055)),
    "portal": material("PortalDepth", (0.025, 0.055, 0.075), 0.48, 0.12),
}


def bind(prim, mat):
    UsdShade.MaterialBindingAPI.Apply(prim).Bind(mat)
    UsdGeom.Gprim(prim).CreateDoubleSidedAttr(True)


def cube(name, center, scale, mat):
    prim = UsdGeom.Cube.Define(stage, f"/VisionStudio/Architecture/{name}")
    prim.CreateSizeAttr(1.0)
    xf = UsdGeom.XformCommonAPI(prim)
    xf.SetTranslate(Gf.Vec3d(*center))
    xf.SetScale(Gf.Vec3f(*scale))
    bind(prim.GetPrim(), mat)
    return prim


def cylinder(name, center, radius, height, mat, rotation=None):
    prim = UsdGeom.Cylinder.Define(stage, f"/VisionStudio/Architecture/{name}")
    prim.CreateRadiusAttr(radius)
    prim.CreateHeightAttr(height)
    xf = UsdGeom.XformCommonAPI(prim)
    xf.SetTranslate(Gf.Vec3d(*center))
    if rotation:
        xf.SetRotate(Gf.Vec3f(*rotation), UsdGeom.XformCommonAPI.RotationOrderXYZ)
    bind(prim.GetPrim(), mat)
    return prim


def mesh(name, points, face_indices, face_counts, mat, colors=None):
    prim = UsdGeom.Mesh.Define(stage, f"/VisionStudio/Architecture/{name}")
    prim.CreatePointsAttr([Gf.Vec3f(*p) for p in points])
    prim.CreateFaceVertexIndicesAttr(face_indices)
    prim.CreateFaceVertexCountsAttr(face_counts)
    prim.CreateSubdivisionSchemeAttr(UsdGeom.Tokens.none)
    if colors:
        color = prim.CreateDisplayColorPrimvar(UsdGeom.Tokens.vertex)
        color.Set([Gf.Vec3f(*c) for c in colors])
    bind(prim.GetPrim(), mat)
    return prim


def curved_panel(name, start_degrees, end_degrees, radius, center_z, bottom, top, mat, steps=12):
    points = []
    for y in (bottom, top):
        for i in range(steps + 1):
            angle = math.radians(start_degrees + (end_degrees - start_degrees) * i / steps)
            points.append((radius * math.sin(angle), y, center_z + radius * math.cos(angle)))
    stride = steps + 1
    indices, counts = [], []
    for i in range(steps):
        indices.extend((i, i + 1, stride + i + 1, stride + i))
        counts.append(4)
    return mesh(name, points, indices, counts, mat)


def torus(name, center, major, minor, mat, horizontal=True, segments=144, tube_segments=10, start=0, end=360):
    points, indices, counts = [], [], []
    for i in range(segments):
        a = math.radians(start + (end - start) * i / segments)
        for j in range(tube_segments):
            b = 2 * math.pi * j / tube_segments
            r = major + minor * math.cos(b)
            if horizontal:
                points.append((center[0] + r * math.cos(a), center[1] + minor * math.sin(b), center[2] + r * math.sin(a)))
            else:
                points.append((center[0] + r * math.cos(a), center[1] + r * math.sin(a), center[2] + minor * math.sin(b)))
    for i in range(segments):
        for j in range(tube_segments):
            a = i * tube_segments + j
            b = i * tube_segments + (j + 1) % tube_segments
            c = ((i + 1) % segments) * tube_segments + (j + 1) % tube_segments
            d = ((i + 1) % segments) * tube_segments + j
            indices.extend((a, b, c, d))
            counts.append(4)
    return mesh(name, points, indices, counts, mat)


# Real-world scale ground plane and concentric inlaid bands.
cylinder("GroundPlane", (0, -0.12, 0), 15.0, 0.24, materials["floor"])
cylinder("CentralStoneInset", (0, 0.004, 0), 5.6, 0.025, materials["floor_light"])
torus("InlaidRingOuter", (0, 0.022, 0), 5.62, 0.018, materials["metal"])
torus("InlaidRingInner", (0, 0.026, 0), 4.95, 0.011, materials["warm_glow"])
torus("InlaidRingFine", (0, 0.026, 0), 4.48, 0.009, materials["metal"])

# Curved room shell; a narrow opening at the rear becomes a framed horizon portal.
wall_radius = 9.0
wall_center_z = -1.4
for i, start in enumerate(range(38, 323, 12)):
    end = min(start + 11.35, 322)
    if start < 200 and end > 160:
        continue
    shade = ["wall_a", "wall_b", "wall_c", "wall_a", "wall_b"][i % 5]
    curved_panel(f"WallFin_{i:02d}", start, end, wall_radius, wall_center_z, 0.0, 5.7, materials[shade], 8)

# Portal cavity, tall side piers, and a luminous floating arch.
cube("PortalRecess", (0, 2.45, -10.3), (3.9, 4.9, 0.12), materials["portal"])
for x, side in ((-2.0, "L"), (2.0, "R")):
    cube(f"PortalPillar_{side}", (x, 2.35, -10.18), (0.18, 4.7, 0.3), materials["floor_light"])
    cube(f"PortalLight_{side}", (x * 0.98, 2.35, -9.98), (0.035, 4.35, 0.025), materials["glow"])
torus("PortalCrown", (0, 2.55, -10.14), 2.0, 0.055, materials["metal"], horizontal=False, start=0, end=180)
cube("PortalLintel", (0, 4.55, -10.14), (3.9, 0.12, 0.2), materials["floor_light"])

# Vertical architectural ribs and low grazing lights animate visually through changing parallax.
for i, angle_degrees in enumerate(range(50, 311, 26)):
    angle = math.radians(angle_degrees)
    x, z = 8.94 * math.sin(angle), wall_center_z + 8.94 * math.cos(angle)
    cylinder(f"Rib_{i:02d}", (x, 2.83, z), 0.045, 5.65, materials["metal"])
    cylinder(f"GrazingLight_{i:02d}", (x * 0.997, 0.16, z * 0.997), 0.018, 0.72, materials["glow"])

# Two monumental sculptural hoops establish scale while leaving a clean view from the browser window.
torus("LeftSculpture", (-5.2, 2.4, -3.9), 1.5, 0.075, materials["glow"], horizontal=False, segments=128)
torus("RightSculpture", (5.2, 2.25, -4.25), 1.35, 0.06, materials["warm_glow"], horizontal=False, segments=128)

# A low circular plinth behind the visitor gives the room a spatial-computing focal point.
cylinder("RearPlinthBase", (0, 0.12, -5.7), 1.25, 0.22, materials["dark"])
cylinder("RearPlinthTop", (0, 0.245, -5.7), 1.18, 0.04, materials["metal"])
torus("PlinthHalo", (0, 0.28, -5.7), 1.2, 0.022, materials["glow"])

stage.GetRootLayer().Save()
result = UsdUtils.CreateNewUsdzPackage(str(USD_PATH), str(USDZ_PATH))
if not result:
    raise RuntimeError("USDZ packaging failed")
print(f"Created {USDZ_PATH} ({USDZ_PATH.stat().st_size:,} bytes)")
