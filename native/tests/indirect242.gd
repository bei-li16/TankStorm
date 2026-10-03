extends SceneTree

var failures = 0
var checks = 0

func expect(ok, context):
	checks += 1
	if not ok:
		failures += 1
		if failures <= 8: print("TRAJECTORY_FAILED: ",context)

# Frozen v0.24.1 direct-fire projection: changes to indirect fire must not affect it.
func old_direct(from, target, launch, t):
	var slope = 115.0 / 305.0
	var rate = launch.y - launch.x * slope
	var entry = from + launch * (-(from.y - 184.0 - from.x * slope) / rate)
	var exit_point = target - launch * ((target.y - 184.0 - target.x * slope) / rate)
	if t < 0.44: return from.lerp(entry,t / 0.44)
	if t < 0.56: return entry.lerp(exit_point,(t - 0.44) / 0.12)
	return exit_point.lerp(target,(t - 0.56) / 0.44)

func _initialize():
	var game = load("res://scripts/game.gd").new()
	game.battle_sprite_meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/battle-sprites.json"))
	var indirect_cases = 0
	var direct_cases = 0
	for cls in ["spg","rocket","tank","tank_destroyer"]:
		var indirect = cls in ["spg","rocket"]
		var angle = 60.0 if cls == "spg" else 45.0
		for tier in range(1,8):
			for side in range(2):
				for slot in range(1,7):
					var pose = game._battle_pose("%s_t%d" % [cls,tier],side,slot)
					for to in range(1,7):
						for ground in [false,true]:
							if ground and not indirect: continue
							var context = [cls,tier,side,slot,to,ground]
							var target = game._battle_position(1-side,to) - (Vector2.ZERO if ground else Vector2(0,20))
							if indirect: indirect_cases += 1
							else: direct_cases += 1
							var p0 = game._shot_point(pose.muzzle,target,pose.launch,0,indirect,angle)
							var p1 = game._shot_point(pose.muzzle,target,pose.launch,1,indirect,angle)
							expect(p0.distance_to(pose.muzzle)<0.001 and p1.distance_to(target)<0.001,[context,"endpoints"])
							for i in range(101):
								var t = i / 100.0
								var p = game._shot_point(pose.muzzle,target,pose.launch,t,indirect,angle)
								var trail = game._shot_trail(pose.muzzle,target,pose.launch,t*0.32,indirect,angle)
								if not indirect:
									expect(p.distance_to(old_direct(pose.muzzle,target,pose.launch,t))<0.002,[context,t,"direct unchanged"])
									continue
								if t>=0.4 and t<=0.6:
									expect(trail.is_empty(),[context,t,"no transit trail"])
								if trail.is_empty() or t==0: continue
								var tangent = (trail.head-trail.tail).normalized()
								if t<0.4:
									expect(tangent.dot(pose.launch)>0.99998,[context,t,"straight barrel exit"])
								else:
									var degrees = rad_to_deg(atan2(tangent.y,absf(tangent.x)))
									expect(absf(degrees-angle)<0.05 and signf(tangent.x)==signf(pose.launch.x),[context,t,"steep downward arrival",degrees])
									expect((target-trail.head).dot(tangent)>0,[context,t,"approaching impact"])
									expect(trail.head.distance_to(trail.tail)<71,[context,t,"no cross-screen tail"])
							if indirect:
								for boundary in [0.4,0.6]:
									var before = game._shot_point(pose.muzzle,target,pose.launch,boundary-0.0001,true,angle)
									var at = game._shot_point(pose.muzzle,target,pose.launch,boundary,true,angle)
									var after = game._shot_point(pose.muzzle,target,pose.launch,boundary+0.0001,true,angle)
									expect((at-before).normalized().dot((after-at).normalized())>0.999,[context,boundary,"smooth hidden join"])
	var result = {"indirect_cases":indirect_cases,"direct_cases":direct_cases,"checks":checks,"failures":failures}
	print("INDIRECT_VALIDATION: ",JSON.stringify(result))
	game.free()
	quit(0 if failures==0 else 1)
