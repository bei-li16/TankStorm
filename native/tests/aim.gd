extends SceneTree

func _initialize():
	var game = load("res://scripts/game.gd").new()
	game.sprite_meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/sprites.json"))
	game.battle_sprite_meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/battle-sprites.json"))
	var errors = 0
	var worst = 1.0
	for id in game.sprite_meta:
		if id.begins_with("core_"):
			continue
		for side in range(2):
			for slot in range(1, 7):
				for target_slot in range(1, 7):
					var target = game._battle_position(1 - side, target_slot) - Vector2(0, 20)
					game.battle_aims["%d:%d" % [side, slot]] = target
					var pose = game._battle_pose(id, side, slot)
					var ray = (pose.muzzle - pose.position).normalized()
					var tangent = (game._shot_point(pose.muzzle, target, pose.launch, 0.001, false) - pose.muzzle).normalized()
					if id.begins_with("rocket") or id.begins_with("spg"):
						tangent = (game._shot_point(pose.muzzle, target, pose.launch, 0.001, true) - pose.muzzle).normalized()
					var dot = ray.dot(tangent)
					worst = minf(worst, dot)
					if game._shot_point(pose.muzzle, target, pose.launch, 0.0, false).distance_to(pose.muzzle) > 0.01 or game._shot_point(pose.muzzle, target, pose.launch, 1.0, false).distance_to(target) > 0.01:
						errors += 1
					if dot < 0.99998:
						errors += 1
						if errors < 4:
							print([id, side, slot, target_slot, dot, pose.muzzle, ray, tangent])
	print("AIM_VALIDATION: ", {"cases":2016, "failures":errors,"minimum_dot":worst})
	game.free()
	quit(0 if errors == 0 else 1)
