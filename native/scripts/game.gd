extends Control

const GOLD = Color("d7b776")
const TEXT = Color("ebe7dc")
const MUTED = Color("949e96")
const GREEN = Color("8fba86")
const RED = Color("de8771")
const PANEL = Color("131c1d")
const LINE = Color("394544")
const RES = ["iron", "oil", "lead", "titanium", "crystal", "gold"]
const CLASSES = ["tank", "tank_destroyer", "spg", "rocket"]
const NAV = [["base", "基地", "COMMAND"], ["factory", "工厂", "ARSENAL"], ["army", "编队", "FORMATION"], ["research", "科研", "RESEARCH"], ["campaign", "战役", "CAMPAIGN"], ["world", "世界", "OPERATIONS"], ["commander", "指挥官", "COMMANDER"], ["reports", "战报", "ARCHIVE"]]
var s: Dictionary = {}
var info: Dictionary = {}
var catalog: Dictionary = {}
var textures: Dictionary = {}
var font: SystemFont
var bold: SystemFont
var latin: SystemFont
var http: HTTPRequest
var port = 0
var token = ""
var pid = -1
var ready_path = ""
var save_root = ""
var waiting = false
var requests: Array = []
var current_request: Dictionary = {}
var startup = 0.0
var poll = 0.0
var clock = 0.0
var fatal = ""
var screen = "base"
var hover = ""
var buttons: Array = []
var toast = ""
var toast_until = 0.0
var selected_building = "hq"
var selected_class = 0
var tier = 1
var quantity = 10
var quantity_input: LineEdit
var production_mode = "produce"
var reserve_page = 0
var campaign_mode = "stage"
var selected_dungeon = 0
var battle_clock = 0.0
var battle_aims: Dictionary = {}
var battle_volley: Array = []
var battle_sprite_meta: Dictionary = {}
var pending_hit = false
var sprite_meta: Dictionary = {}
var selected_slot = 0
var draft: Array = []
var dirty = false
var drag_slot = -1
var selected_stage = 0
var selected_site = "site-0"
var map_zoom = 1.0
var map_center = Vector2(16, 16)
var map_drag = false
const MAP_RECT = Rect2(65, 250, 896, 500)
var report: Dictionary = {}
var battle_armies: Array = []
var battle_index = 0
var battle_time = 0.0
var battle_speed = 1.0
var battle_paused = false
var last_hit: Dictionary = {}
var hit_time = 0.0
var report_page = 0
var save_page = 0
var quest_page = 0
var queue_page = 0
var march_page = 0
var battle_deaths: Dictionary = {}
var saves: Array = []
var dialog_mode = ""
var text_dialog: ConfirmationDialog
var confirm_dialog: ConfirmationDialog
var pending_action: Dictionary = {}
var pending_request: Dictionary = {}
var details_dialog: AcceptDialog
var details_text: TextEdit
var name_input: LineEdit
var file_dialog: FileDialog
var export_path = ""
var muted = false
var player: AudioStreamPlayer
var battle_audio: Dictionary = {}
var battle_voices: Array[AudioStreamPlayer] = []
var battle_audio_events: Array = []
var suppress_battle_audio = false
var test_mode = false
var measure_frames = false
var frame_times: Array = []

func _ready():
	Engine.max_fps = 60
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	DisplayServer.window_set_min_size(Vector2i(1120, 630))
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei UI", "Microsoft YaHei", "Arial"])
	bold = SystemFont.new()
	bold.font_names = font.font_names
	bold.font_weight = 700
	latin = SystemFont.new()
	latin.font_names = PackedStringArray(["Bahnschrift", "Segoe UI", "Arial"])
	var ui_theme = Theme.new()
	ui_theme.default_font = font
	ui_theme.default_font_size = 20
	theme = ui_theme
	for name in ["base", "tank", "tank_destroyer", "spg", "rocket", "resources", "battlefield", "worldmap", "emblem", "tank-tiers", "tank_destroyer-tiers", "spg-tiers", "rocket-tiers", "march_ground", "combat_fx", "battle_tank", "battle_tank_destroyer", "battle_spg", "battle_rocket", "battle_terrain", "battle_edges", "destruction_fx", "battle_wrecks"]:
		if ResourceLoader.exists("res://assets/" + name + ".png"):
			textures[name] = load("res://assets/" + name + ".png")
	sprite_meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/sprites.json"))
	for key in sprite_meta:
		var data = sprite_meta[key]
		var sprite = AtlasTexture.new()
		sprite.atlas = textures[data.atlas]
		sprite.region = Rect2(data.rect[0], data.rect[1], data.rect[2], data.rect[3])
		sprite.filter_clip = true
		textures[key] = sprite
	battle_sprite_meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/battle-sprites.json"))
	for key in battle_sprite_meta:
		var data = battle_sprite_meta[key]
		var sprite = AtlasTexture.new()
		sprite.atlas = textures[data.atlas]
		sprite.region = Rect2(data.rect[0], data.rect[1], data.rect[2], data.rect[3])
		sprite.filter_clip = true
		textures[key] = sprite
	texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	http = HTTPRequest.new()
	http.timeout = 12.0
	add_child(http)
	http.request_completed.connect(_response)
	_setup_dialogs()
	var prefs = ConfigFile.new()
	if prefs.load("user://preferences.cfg") == OK:
		muted = prefs.get_value("audio", "muted", false)
	player = AudioStreamPlayer.new()
	add_child(player)
	for cls in CLASSES:
		for phase in ["fire", "impact"]:
			var key = cls + "_" + phase
			battle_audio[key] = load("res://assets/audio/" + key + ".wav")
	for i in range(8):
		var voice = AudioStreamPlayer.new()
		add_child(voice)
		battle_voices.append(voice)
	test_mode = "--smoke" in OS.get_cmdline_user_args()
	_start_runtime()
	if test_mode:
		if "--battle-preview" in OS.get_cmdline_user_args() or "--v06-preview" in OS.get_cmdline_user_args() or "--v07-preview" in OS.get_cmdline_user_args():
			_battle_preview()
		else:
			_smoke_test()

func _start_runtime():
	save_root = OS.get_environment("APPDATA").path_join("TankStormClassic/saves")
	if test_mode:
		save_root = ProjectSettings.globalize_path("user://smoke-" + str(OS.get_process_id()))
	DirAccess.make_dir_recursive_absolute(save_root)
	ready_path = save_root.path_join("ready-" + str(OS.get_process_id()) + ".json")
	token = Crypto.new().generate_random_bytes(24).hex_encode()
	var base = OS.get_executable_path().get_base_dir()
	if OS.has_feature("editor"):
		base = ProjectSettings.globalize_path("res://../release/development")
	var runtime = base.path_join("runtime/node.exe")
	var bridge = base.path_join("rules/bridge.cjs")
	if not FileAccess.file_exists(runtime) or not FileAccess.file_exists(bridge):
		fatal = "缺少游戏运行文件。请保留 TankStorm 文件夹的完整内容。"
		return
	pid = OS.create_process(runtime, PackedStringArray([bridge, "--serve", save_root, ready_path, token, str(OS.get_process_id())]), false)
	if pid < 0:
		fatal = "无法启动本地游戏规则，请检查游戏文件是否完整。"

func _setup_dialogs():
	quantity_input = LineEdit.new()
	quantity_input.position = Vector2(748, 465)
	quantity_input.size = Vector2(112, 42)
	quantity_input.max_length = 5
	quantity_input.alignment = HORIZONTAL_ALIGNMENT_CENTER
	quantity_input.text = str(quantity)
	quantity_input.placeholder_text = "数量"
	quantity_input.add_theme_color_override("font_color", TEXT)
	quantity_input.add_theme_color_override("caret_color", GOLD)
	var quantity_style = StyleBoxFlat.new()
	quantity_style.bg_color = Color("0d1818")
	quantity_style.border_color = GOLD
	quantity_style.set_border_width_all(1)
	quantity_input.add_theme_stylebox_override("normal", quantity_style)
	quantity_input.add_theme_stylebox_override("focus", quantity_style)
	quantity_input.text_changed.connect(func(value): quantity = int(value) if value.is_valid_int() and int(value) >= 0 and int(value) <= 10000 else 0)
	add_child(quantity_input)
	text_dialog = ConfirmationDialog.new()
	text_dialog.title = "指挥官档案"
	text_dialog.min_size = Vector2i(460, 160)
	text_dialog.ok_button_text = "确认"
	text_dialog.cancel_button_text = "取消"
	name_input = LineEdit.new()
	name_input.max_length = 16
	name_input.placeholder_text = "输入指挥官名称（1–16 字）"
	name_input.custom_minimum_size = Vector2(430, 44)
	text_dialog.add_child(name_input)
	text_dialog.confirmed.connect(_text_confirmed)
	add_child(text_dialog)
	file_dialog = FileDialog.new()
	file_dialog.access = FileDialog.ACCESS_FILESYSTEM
	file_dialog.filters = PackedStringArray(["*.json ; 坦克风云存档"])
	file_dialog.use_native_dialog = true
	file_dialog.file_selected.connect(_file_selected)
	add_child(file_dialog)
	confirm_dialog = ConfirmationDialog.new()
	confirm_dialog.title = "确认操作"
	confirm_dialog.ok_button_text = "确认执行"
	confirm_dialog.cancel_button_text = "取消"
	confirm_dialog.min_size = Vector2i(550, 210)
	confirm_dialog.confirmed.connect(_confirm_action)
	confirm_dialog.canceled.connect(_cancel_action)
	add_child(confirm_dialog)
	details_dialog = AcceptDialog.new()
	details_dialog.title = "行动详情"
	details_dialog.ok_button_text = "关闭"
	details_text = TextEdit.new()
	details_text.editable = false
	details_text.add_theme_color_override("font_readonly_color", TEXT)
	var paper = StyleBoxFlat.new()
	paper.bg_color = PANEL
	paper.border_color = LINE
	paper.set_border_width_all(1)
	paper.content_margin_left = 18
	paper.content_margin_right = 18
	paper.content_margin_top = 14
	paper.content_margin_bottom = 14
	details_text.add_theme_stylebox_override("read_only", paper)
	details_text.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	details_text.custom_minimum_size = Vector2(1000, 580)
	details_dialog.add_child(details_text)
	add_child(details_dialog)

func _confirm(command_data: Dictionary, message: String):
	pending_request = {}
	pending_action = command_data
	confirm_dialog.dialog_text = message
	confirm_dialog.popup_centered()

func _confirm_action():
	if not pending_request.is_empty():
		request(pending_request)
		pending_request = {}
	elif not pending_action.is_empty():
		command(pending_action)
		pending_action = {}
	confirm_dialog.hide()

func _cancel_action():
	pending_request = {}
	pending_action = {}

func _switch_request(payload: Dictionary):
	if dirty:
		pending_action = {}
		pending_request = payload
		confirm_dialog.dialog_text = "当前编队有未保存的编辑。\n继续将放弃这些编辑并切换存档；已经保存的游戏进度会保留。\n若要保留编辑，请取消后按 F5 保存。"
		confirm_dialog.popup_centered()
	else:
		request(payload)

func _details(title: String, value: String):
	details_dialog.title = title
	details_text.text = value
	details_text.scroll_vertical = 0
	details_dialog.popup_centered()

func _cost_text(cost, multiplier = 1):
	var parts: Array[String] = []
	for r in RES:
		if cost.get(r, 0) > 0:
			parts.append(catalog.resourceNames[r] + " " + str(int(cost[r] * multiplier)))
	return "、".join(parts)

func _process(delta):
	_sync_battle_audio()
	clock += delta
	quantity_input.visible = screen == "factory" and not s.is_empty()
	if measure_frames:
		frame_times.append(delta * 1000.0)
	if port == 0 and fatal == "":
		startup += delta
		if FileAccess.file_exists(ready_path):
			var data = JSON.parse_string(FileAccess.get_file_as_string(ready_path))
			if data is Dictionary:
				if data.has("error"):
					fatal = data.error
				elif data.has("port"):
					port = int(data.port)
					request({"op": "boot"})
		elif startup > 20:
			fatal = "游戏启动超时。请重新启动，或检查运行目录中的 runtime 文件夹。"
	if port > 0 and not s.is_empty():
		poll += delta
		if poll >= 1.0 and not waiting and requests.is_empty():
			poll = 0
			request({"op": "tick"})
	if screen == "battle" and not report.is_empty() and not battle_paused:
		_battle_step(delta)
	queue_redraw()

func request(payload: Dictionary):
	if waiting:
		requests.append(payload)
		return
	waiting = true
	current_request = payload
	var err = http.request("http://127.0.0.1:" + str(port) + "/rpc", PackedStringArray(["Content-Type: application/json", "Authorization: Bearer " + token]), HTTPClient.METHOD_POST, JSON.stringify(payload))
	if err != OK:
		waiting = false
		toast_message("本地运行时连接失败，请重新启动游戏")

func _command_pending():
	# Background resource polling must not swallow a mouse click.
	return waiting and current_request.get("op", "") != "tick"

func command(data: Dictionary):
	request({"op": "command", "command": data, "id": Crypto.new().generate_random_bytes(12).hex_encode()})

func _response(result, _code, _headers, body):
	waiting = false
	var data = JSON.parse_string(body.get_string_from_utf8())
	if result != HTTPRequest.RESULT_SUCCESS or not data is Dictionary:
		toast_message("连接中断，已提交的操作会保留在本地存档中")
	elif not data.get("ok", false):
		toast_message(data.get("error", "操作未完成"))
		if s.is_empty():
			fatal = data.get("error", "存档加载失败")
	else:
		s = data.state
		info = data.info
		if data.has("catalog"):
			catalog = data.catalog
			draft = info.usable.duplicate(true)
			toast_message("指挥官，欢迎归队。点击基地建筑开始建设。")
		if data.has("saves"):
			saves = data.saves
		if data.get("formationSaved", false) or current_request.op == "autoFormation" or current_request.op in ["new", "copy", "load", "import", "restore"] or (current_request.op == "command" and current_request.command.type in ["formation", "presetLoad"]):
			dirty = false
			draft = info.usable.duplicate(true)
		if current_request.op in ["boot", "new", "copy", "load", "import", "restore"]:
			selected_site = s.world[0].id
			save_page = 0
			report_page = 0
			map_center = Vector2(s.home.x, s.home.y)
		if not data.get("message", "").is_empty() and not data.has("report"):
			toast_message(data.message)
		if not data.get("recovered", "").is_empty():
			toast_message(data.recovered)
		if data.has("report"):
			open_report(data.report)
		if data.has("text") and not export_path.is_empty():
			var temporary = export_path + "." + Crypto.new().generate_random_bytes(8).hex_encode() + ".tmp"
			var f = FileAccess.open(temporary, FileAccess.WRITE)
			if f:
				f.store_string(data.text)
				f.flush()
				var error = f.get_error()
				f.close()
				if error == OK:
					error = DirAccess.rename_absolute(temporary, export_path)
				if error == OK:
					toast_message("存档已导出：" + export_path.get_file())
				else:
					DirAccess.remove_absolute(temporary)
					toast_message("导出写入失败，原有文件保留，请选择其他位置")
			else:
				toast_message("无法写入该目录，请选择其他位置")
			export_path = ""
		if screen == "army" and not dirty:
			draft = info.usable.duplicate(true)
	if not requests.is_empty():
		request(requests.pop_front())

func toast_message(message: String):
	toast = message
	toast_until = clock + 5

func _gui_input(event):
	if screen == "world" and event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_RIGHT:
			map_drag = event.pressed and MAP_RECT.has_point(event.position)
		elif event.pressed and MAP_RECT.has_point(event.position):
			if event.button_index == MOUSE_BUTTON_WHEEL_UP:
				_map_zoom(1.25)
			elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				_map_zoom(0.8)
	if event is InputEventMouseMotion:
		if screen == "world" and map_drag:
			map_center -= event.relative / (MAP_RECT.size / 32.0 * map_zoom)
			_map_clamp()
		hover = ""
		for b in buttons:
			if b.rect.has_point(event.position):
				hover = b.id
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND if hover != "" else Control.CURSOR_ARROW
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			drag_slot = -1
			for i in range(buttons.size() - 1, -1, -1):
				var b = buttons[i]
				if b.rect.has_point(event.position) and b.enabled:
					if b.id.begins_with("slot:"):
						drag_slot = int(b.data)
					_action(b.id, b.data)
					break
		elif drag_slot >= 0:
			for b in buttons:
				if b.id.begins_with("slot:") and b.rect.has_point(event.position) and int(b.data) != drag_slot:
					var temp = draft[drag_slot]
					draft[drag_slot] = draft[int(b.data)]
					draft[int(b.data)] = temp
					dirty = true
					break
			drag_slot = -1

func _unhandled_key_input(event):
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	if text_dialog.visible or confirm_dialog.visible or details_dialog.visible or file_dialog.visible:
		return
	if event.keycode == KEY_F11:
		_toggle_fullscreen()
	elif event.keycode == KEY_F5 and not s.is_empty() and not _command_pending():
		_action("save")
	elif event.keycode == KEY_ESCAPE:
		_navigate("base" if screen != "base" else "settings")
	elif event.keycode == KEY_SPACE and screen == "battle":
		battle_paused = not battle_paused
	elif event.keycode >= KEY_1 and event.keycode <= KEY_8:
		_navigate(NAV[event.keycode - KEY_1][0])

func _navigate(target):
	if screen == "army" and dirty:
		toast_message("未保存的编队已保留，返回编队后可继续编辑")
	screen = target
	if screen == "army" and not dirty:
		draft = info.usable.duplicate(true)
	if screen == "settings":
		request({"op": "list"})

func _action(id, data = null):
	_sound(false)
	if id.begins_with("nav:"):
		_navigate(data)
	elif id.begins_with("building:"):
		selected_building = data
	elif id == "rootLogin" or id == "rootPassword":
		_text_prompt(id, "")
	elif id == "rootLogout":
		request({"op": "rootLogout"})
	elif id == "rootRecharge":
		_text_prompt("rootRecharge", "960")
	elif id == "vipDaily":
		command({"type": "vipDaily"})
	elif id == "queuePrev":
		queue_page = maxi(0, queue_page - 1)
	elif id == "queueNext":
		queue_page += 1
	elif id == "marchNext":
		march_page = (march_page + 1) % maxi(1, ceili(s.marches.size() / 2.0))
	elif id == "upgrade":
		command({"type": "upgrade", "building": selected_building})
	elif id.begins_with("cancel:") or id.begins_with("accelerate:"):
		var j = _find_job(data)
		if not j.is_empty():
			if id.begins_with("cancel:"):
				var refund = _cost_text(j.unitCost, j.total - j.completed)
				if j.has("coreCost"):
					refund += "、" + catalog.coreNames[j.coreCost.id] + " ×%d" % (j.total - j.completed)
				if j.has("sourceUnitId"):
					refund += "、" + catalog.units[j.sourceUnitId].name + " ×%d" % (j.total - j.completed)
				_confirm({"type": "cancel", "kind": j.kind, "seq": int(j.seq)}, "取消剩余 %d 项作业？\n已完成部分保留，返还：%s。" % [j.total - j.completed, refund])
			else:
				_confirm({"type": "accelerate", "kind": j.kind, "seq": int(j.seq)}, "立即完成此项目？\n" + ("VIP 免费完成。" if j.acceleration == 0 else "预计消耗 %d 金币，执行时按剩余时间结算。" % j.acceleration))
	elif id.begins_with("class:"):
		selected_class = int(data)
	elif id.begins_with("tier:"):
		tier = int(data)
	elif id.begins_with("quantity:"):
		_set_quantity(int(data))
	elif id == "quantityMax":
		_set_quantity(int(info.unitStats[_unit_id()][production_mode].max))
	elif id.begins_with("productionMode:"):
		production_mode = data
	elif id == "qtyminus":
		_set_quantity(maxi(1, quantity - 1))
	elif id == "qtyplus":
		_set_quantity(mini(10000, quantity + 1))
	elif id == "produce" or id == "repair":
		command({"type": production_mode if id == "produce" else "repair", "unitId": _unit_id(), "count": quantity})
	elif id == "reserveNext":
		reserve_page = (reserve_page + 1) % int(ceil(catalog.unitList.size() / 12.0))
	elif id == "reservePrev":
		reserve_page = maxi(0, reserve_page - 1)
	elif id.begins_with("campaignMode:"):
		campaign_mode = data
	elif id.begins_with("dungeon:"):
		selected_dungeon = int(data)
	elif id == "dungeonAttack" or id == "dungeonTraining":
		command({"type": "dungeon", "dungeonId": catalog.dungeons[selected_dungeon].id, "training": id == "dungeonTraining"})
	elif id.begins_with("research:"):
		command({"type": "research", "tech": data})
	elif id.begins_with("slot:"):
		selected_slot = int(data)
	elif id.begins_with("assign:"):
		_assign(data)
	elif id == "slotclear":
		draft[selected_slot] = null
		dirty = true
	elif id == "slotminus" or id == "slotplus":
		if draft[selected_slot] != null:
			var st = draft[selected_slot]
			if id == "slotminus":
				st.count = maxi(1, int(st.count) - 1)
			else:
				st.count = mini(_free_for_slot(st.unitId), mini(info.leadership, st.count + 1))
			dirty = true
	elif id == "formationSave":
		command({"type": "formation", "slots": draft})
	elif id == "formationAuto":
		dirty = false
		request({"op": "autoFormation"})
	elif id == "presetSave":
		if dirty:
			toast_message("请先保存当前编队，再保存预设")
		else:
			_text_prompt("preset", "新编队 " + str(s.presets.size() + 1))
	elif id.begins_with("presetLoad:"):
		dirty = false
		command({"type": "presetLoad", "index": data})
	elif id.begins_with("stage:"):
		selected_stage = int(data)
	elif id == "attack" or id == "training":
		command({"type": "battle", "stage": selected_stage, "training": id == "training"})
	elif id == "battlePause":
		battle_paused = not battle_paused
	elif id == "battleSpeed":
		battle_speed = 2.0 if battle_speed == 1.0 else 4.0 if battle_speed == 2.0 else 1.0
	elif id == "battleSkip":
		_seek_battle_end()
	elif id == "battleReplay":
		open_report(report)
	elif id == "battleDetails":
		_report_details()
	elif id == "coreDungeons":
		campaign_mode = "dungeon"
		_navigate("campaign")
	elif id == "unitGuide":
		_unit_guide()
	elif id.begins_with("rest:"):
		_confirm({"type": "rest", "minutes": int(data)}, "休整 %d 小时？\n按正常规则结算资源、队列、世界补给与全部在途行军。\n期间的出征可能发生战斗和战损；无额外资源奖励。" % (int(data) / 60))
	elif id.begins_with("site:"):
		selected_site = data
	elif id == "mapSearch":
		_text_prompt("coordinate", "%d,%d" % [_site().x, _site().y])
	elif id == "mapHome":
		map_center = Vector2(s.home.x + 0.5, s.home.y + 0.5)
		_map_clamp()
	elif id == "mapSelected":
		map_center = Vector2(_site().x + 0.5, _site().y + 0.5)
		_map_clamp()
	elif id == "mapZoomIn" or id == "mapZoomOut":
		_map_zoom(1.5 if id == "mapZoomIn" else 1.0 / 1.5)
	elif id == "scout":
		command({"type": "scout", "targetId": selected_site})
	elif id == "gather" or id == "raid":
		command({"type": "march", "targetId": selected_site, "mission": id})
	elif id.begins_with("recall:"):
		_confirm({"type": "recall", "marchId": data}, "召回此部队？\n仅携带已经采到的物资；回到基地后才会入库。")
	elif id == "leadership" or id == "skill" or id == "daily":
		command({"type": id})
	elif id.begins_with("claim:"):
		command({"type": "claim", "questId": data})
	elif id == "questNext":
		quest_page = (quest_page + 1) % 2
	elif id.begins_with("report:"):
		request({"op": "report", "id": data})
	elif id == "reportsNext":
		report_page = mini(report_page + 1, maxi(0, int(ceil(s.reports.size() / 6.0)) - 1))
	elif id == "reportsPrev":
		report_page = maxi(0, report_page - 1)
	elif id == "savesNext":
		save_page = mini(save_page + 1, maxi(0, int(ceil(saves.size() / 7.0)) - 1))
	elif id == "savesPrev":
		save_page = maxi(0, save_page - 1)
	elif id == "save":
		var payload = {"op": "save"}
		if dirty:
			payload.formation = draft.duplicate(true)
		request(payload)
	elif id == "rename" or id == "new" or id == "copy":
		_text_prompt(id, s.nickname if id == "rename" else (s.nickname.substr(0, 13) + "·副本") if id == "copy" else "新指挥官")
	elif id == "export" or id == "import":
		if id == "export" and dirty:
			toast_message("编队尚未保存，请先按 F5 保存，再导出完整进度")
			return
		file_dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE if id == "export" else FileDialog.FILE_MODE_OPEN_FILE
		file_dialog.title = "导出存档" if id == "export" else "导入存档（新存档槽）"
		file_dialog.current_file = "TankStorm-" + s.nickname.validate_filename() + "-" + s.id.substr(0, 8) + ".json" if id == "export" else ""
		dialog_mode = id
		file_dialog.popup_centered(Vector2i(900, 600))
	elif id == "restore":
		dialog_mode = "restore"
		name_input.hide()
		text_dialog.title = "恢复备份"
		text_dialog.dialog_text = "恢复最近一次操作前的备份？当前进度将回退。" + ("\n未保存的编队编辑也会被放弃。" if dirty else "")
		text_dialog.popup_centered()
	elif id.begins_with("load:"):
		_switch_request({"op": "load", "id": data})
	elif id == "fullscreen":
		_toggle_fullscreen()
	elif id == "sound":
		muted = not muted
		var prefs = ConfigFile.new()
		prefs.set_value("audio", "muted", muted)
		prefs.save("user://preferences.cfg")
	elif id == "savefolder":
		OS.shell_open(save_root)

func _text_prompt(mode, value):
	dialog_mode = mode
	text_dialog.dialog_text = ""
	name_input.show()
	name_input.secret = mode in ["rootLogin", "rootPassword"]
	name_input.max_length = 64 if name_input.secret else 8 if mode == "rootRecharge" else 16
	text_dialog.title = "定位坐标（0—31）" if mode == "coordinate" else "指挥官档案"
	name_input.placeholder_text = "输入 X,Y，例如 17,16" if mode == "coordinate" else "输入名称"
	if mode.begins_with("root"):
		text_dialog.title = {"rootLogin": "root 管理 · 输入密码", "rootPassword": "设置新的 root 密码（8–64 字符）", "rootRecharge": "模拟充值金币（1–10000000）"}[mode]
		name_input.placeholder_text = "输入密码" if name_input.secret else "金币数量"
	name_input.text = value
	text_dialog.popup_centered()
	name_input.grab_focus()
	name_input.select_all()

func _text_confirmed():
	if dialog_mode in ["rootLogin", "rootPassword"]:
		request({"op": dialog_mode, "password": name_input.text})
		name_input.text = ""
	elif dialog_mode == "rootRecharge":
		if name_input.text.is_valid_int():
			command({"type": "vipRecharge", "gold": int(name_input.text)})
		else:
			toast_message("请输入整数金币数量")
	elif dialog_mode == "new":
		_switch_request({"op": "new", "nickname": name_input.text, "seed": randi_range(1, 2147483647)})
	elif dialog_mode == "copy":
		var payload = {"op": "copy", "nickname": name_input.text}
		if dirty:
			payload.formation = draft.duplicate(true)
		request(payload)
	elif dialog_mode == "rename":
		command({"type": "rename", "nickname": name_input.text})
	elif dialog_mode == "preset":
		command({"type": "presetSave", "name": name_input.text})
	elif dialog_mode == "restore":
		request({"op": "restore"})
	elif dialog_mode == "coordinate":
		_locate_coordinates(name_input.text)

func _map_clamp():
	var half = 16.0 / map_zoom
	map_center = map_center.clamp(Vector2(half, half), Vector2(32 - half, 32 - half))

func _map_zoom(factor):
	map_zoom = clampf(map_zoom * factor, 1.0, 3.0)
	_map_clamp()

func _locate_coordinates(value):
	var parts = value.replace("，", ",").replace(" ", "").split(",")
	if parts.size() != 2 or not parts[0].is_valid_int() or not parts[1].is_valid_int():
		toast_message("请输入 0—31 范围内的 X,Y 坐标")
		return
	var target = Vector2(int(parts[0]), int(parts[1]))
	if target.x < 0 or target.y < 0 or target.x > 31 or target.y > 31:
		toast_message("坐标必须在 0—31 之间")
		return
	map_zoom = maxf(2.0, map_zoom)
	map_center = target + Vector2(0.5, 0.5)
	_map_clamp()
	for site in s.world:
		if Vector2(site.x, site.y) == target:
			selected_site = site.id
			toast_message("已定位：" + site.name)
			return
	toast_message("已定位到空地；右侧仍显示之前选中的目标")

func _map_point(pos: Vector2):
	return MAP_RECT.get_center() + (pos - map_center) * (MAP_RECT.size / 32.0 * map_zoom)

func _file_selected(path):
	if dialog_mode == "export":
		export_path = path
		request({"op": "export"})
	else:
		var f = FileAccess.open(path, FileAccess.READ)
		if not f or f.get_length() > 20000000:
			toast_message("无法读取文件，或存档超过 20 MB")
			return
		_switch_request({"op": "import", "text": f.get_as_text()})
		f.close()

func _toggle_fullscreen():
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)

func _free_for_slot(unit):
	var free = int(s.available[unit])
	for i in range(6):
		if i != selected_slot and draft[i] != null and draft[i].unitId == unit:
			free -= int(draft[i].count)
	return maxi(0, free)

func _assign(unit):
	var n = mini(int(info.leadership), _free_for_slot(unit))
	if n <= 0:
		toast_message("该战车没有可分配库存，请先生产或调整其他阵位")
		return
	draft[selected_slot] = {"unitId": unit, "count": n}
	dirty = true

func _unit_id():
	return CLASSES[selected_class] + "_t" + str(tier)

func _set_quantity(value):
	quantity = clampi(value, 0, 10000)
	quantity_input.text = str(quantity)

func _sound(_shot: bool):
	if muted:
		return
	var wav = AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = 22050
	var duration = 0.055
	var bytes = PackedByteArray()
	bytes.resize(int(22050 * duration) * 2)
	for i in range(int(bytes.size() / 2.0)):
		var t = float(i) / 22050.0
		var v = (sin(t * TAU * 800) * 0.5 + randf_range(-0.5, 0.5) * 0.1) * exp(-t * 65)
		bytes.encode_s16(i * 2, int(v * 5000))
	wav.data = bytes
	var audio = player
	audio.stream = wav
	audio.play()

func _draw():
	buttons.clear()
	draw_rect(Rect2(0, 0, 1600, 900), Color("091112"))
	if screen == "qa_atlas" and test_mode:
		for cls in range(4):
			for t in range(1, 8):
				var p = Vector2(10 + (t - 1) * 227, 15 + cls * 217)
				var id = CLASSES[cls] + "_t" + str(t)
				_image(id, Rect2(p, Vector2(218, 181)))
				_text(catalog.units[id].name, p + Vector2(10, 205), 17, TEXT)
		return
	if s.is_empty():
		_loading()
		return
	if screen == "battle":
		_draw_battle()
	else:
		_header()
		match screen:
			"base": _draw_base()
			"factory": _draw_factory()
			"army": _draw_army()
			"research": _draw_research()
			"campaign": _draw_campaign()
			"world": _draw_world()
			"commander": _draw_commander()
			"reports": _draw_reports()
			"settings": _draw_settings()
			"vip": _draw_vip()
			"queues": _draw_queues()
		_navbar()
	if toast_until > clock and toast != "":
		var w = minf(1100, maxf(400, font.get_string_size(toast, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x + 54))
		_panel(Rect2((1600 - w) / 2, 783, w, 43), Color("25322b"), GOLD)
		_text(toast, Vector2((1600 - w) / 2 + 26, 811), 17, TEXT)

func _text(value, pos: Vector2, size_px = 18, color = TEXT, heavy = false):
	draw_string(bold if heavy else font, pos, str(value), HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)

func _small(value, pos: Vector2, size_px = 13, color = MUTED):
	draw_string(latin, pos, str(value), HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)

func _panel(r: Rect2, color = PANEL, border = LINE):
	draw_rect(r, color)
	draw_rect(r, border, false, 1)
	draw_line(r.position + Vector2(1, 1), r.position + Vector2(r.size.x - 1, 1), border.lightened(0.1), 1)
	for p in [r.position + Vector2(5, 5), r.end - Vector2(5, 5)]:
		draw_circle(p, 1.5, border)

func _button(id: String, label: String, r: Rect2, data = null, active = false, enabled = true):
	var c = Color("334039") if hover == id else Color("222e2b")
	if active:
		c = Color("766341") if hover == id else Color("615338")
	if not enabled:
		c = Color("182122")
	_panel(r, c, GOLD if active and enabled else LINE)
	var text_color = TEXT if enabled else Color("67726b")
	var tw = font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
	_text(label, Vector2(r.position.x + (r.size.x - tw) / 2, r.position.y + r.size.y / 2 + 6), 17, text_color)
	buttons.append({"id": id, "rect": r, "data": data, "enabled": enabled})

func _hit(id: String, r: Rect2, data = null):
	buttons.append({"id": id, "rect": r, "data": data, "enabled": true})

func _image(name, r: Rect2, color = Color.WHITE, flip = false):
	if catalog.get("units", {}).has(name) and battle_sprite_meta.has(name + "_sw"):
		var meta = battle_sprite_meta[name + "_sw"]
		var factor = [0.53, 0.61, 0.69, 0.77, 0.85, 0.93, 1.0][int(name.right(1)) - 1]
		var fit = minf(r.size.x / meta.rect[2], r.size.y / meta.rect[3]) * factor
		var sz = Vector2(meta.rect[2], meta.rect[3]) * fit
		var origin = r.position + Vector2((r.size.x - sz.x) * 0.5, (r.size.y - sz.y) * 0.7)
		_draw_sprite_polygon(meta, origin, Vector2.ZERO, fit, color)
		return
	if not textures.has(name):
		return
	var tex = textures[name]
	var ratio = minf(r.size.x / tex.get_width(), r.size.y / tex.get_height())
	var sz = tex.get_size() * ratio
	var dest = Rect2(r.position + (r.size - sz) / 2, sz)
	if flip:
		dest.size.x *= -1
	draw_texture_rect(tex, dest, false, color)

func _cover(name, r: Rect2, color = Color.WHITE):
	if not textures.has(name):
		return
	var tex = textures[name]
	var ratio = maxf(r.size.x / tex.get_width(), r.size.y / tex.get_height())
	var source = Rect2((tex.get_size() - r.size / ratio) / 2, r.size / ratio)
	draw_texture_rect_region(tex, r, source, color)

func _icon(index: int, r: Rect2):
	if textures.has("resources"):
		var tex = textures.resources
		var cell = Vector2(tex.get_width() / 3.0, tex.get_height() / 2.0)
		draw_texture_rect_region(tex, r, Rect2(Vector2(index % 3, int(index / 3.0)) * cell, cell))
	else:
		draw_circle(r.get_center(), r.size.x * 0.25, GOLD)

func _bar(r: Rect2, value: float, color = GREEN):
	draw_rect(r, Color("080e0e"))
	draw_rect(Rect2(r.position, Vector2(r.size.x * clampf(value, 0, 1), r.size.y)), color)

func _time(ms):
	var seconds = maxi(0, int(ceil(float(ms) / 1000.0)))
	return "%02d:%02d:%02d" % [int(seconds / 3600.0), int(seconds / 60.0) % 60, seconds % 60] if seconds >= 3600 else "%02d:%02d" % [int(seconds / 60.0), seconds % 60]

func _cost(cost, pos: Vector2, multiplier = 1):
	var x = pos.x
	for i in range(6):
		var value = int(cost.get(RES[i], 0)) * multiplier
		if value <= 0:
			continue
		_icon(i, Rect2(x, pos.y - 21, 32, 32))
		_text(str(value), Vector2(x + 35, pos.y + 2), 16, TEXT if s.wallet[RES[i]] >= value else RED)
		x += 100 if value < 10000 else 120

func _title(title, subtitle):
	_small(subtitle, Vector2(40, 115), 13, GOLD)
	_text(title, Vector2(40, 158), 32, TEXT, true)
	draw_line(Vector2(40, 181), Vector2(1560, 181), LINE)

func _loading():
	_cover("base", Rect2(0, 0, 1600, 900), Color(0.4, 0.43, 0.39))
	draw_rect(Rect2(0, 0, 1600, 900), Color(0.025, 0.04, 0.04, 0.5))
	_small("T A N K S T O R M   /   C L A S S I C", Vector2(570, 340), 20, GOLD)
	_text("坦 克 风 云", Vector2(565, 425), 66, TEXT, true)
	_text("经 典 归 来", Vector2(665, 477), 24, GOLD)
	_text("正在接通基地指挥系统……" if fatal == "" else fatal, Vector2(480, 590), 20, TEXT)
	if fatal != "":
		_small("Restart the game after resolving the issue.", Vector2(550, 628))
	else:
		_bar(Rect2(530, 630, 540, 3), minf(0.95, startup / 6.0), GOLD)

func _header():
	_panel(Rect2(0, 0, 1600, 82), Color("111a1b"), Color("4a5044"))
	_text("坦克风云", Vector2(28, 34), 25, GOLD, true)
	_small("CLASSIC  /  WINDOWS", Vector2(29, 58), 11)
	draw_line(Vector2(203, 16), Vector2(203, 65), LINE)
	for i in range(6):
		var x = 222 + i * 172
		_icon(i, Rect2(x, 14, 53, 53))
		_text(catalog.resourceNames[RES[i]], Vector2(x + 57, 29), 13, MUTED)
		_small(str(int(s.wallet[RES[i]])), Vector2(x + 57, 55), 24, GOLD if i == 5 else TEXT)
	_button("nav:settings", "存档 / 设置", Rect2(1395, 20, 172, 43), "settings", screen == "settings")
	_small("LV.%02d" % int(info.level), Vector2(1282, 36), 21, GOLD)
	_button("nav:vip", "VIP %d" % info.vip.level, Rect2(1270, 43, 99, 28), "vip", screen == "vip")

func _navbar():
	_panel(Rect2(0, 836, 1600, 64), Color("10191a"), Color("596052"))
	for i in range(8):
		var x = 32 + i * 180
		var active = screen == NAV[i][0]
		if active:
			draw_rect(Rect2(x, 837, 164, 62), Color("32372b"))
			draw_rect(Rect2(x, 837, 164, 3), GOLD)
		elif hover == "nav:" + NAV[i][0]:
			draw_rect(Rect2(x, 837, 164, 62), Color("202b29"))
		_small("0" + str(i + 1), Vector2(x + 13, 868), 18, GOLD if active else MUTED)
		_text(NAV[i][1], Vector2(x + 49, 865), 19, TEXT if active else MUTED, active)
		_small(NAV[i][2], Vector2(x + 49, 884), 9, MUTED)
		_hit("nav:" + NAV[i][0], Rect2(x, 836, 164, 64), NAV[i][0])
	_small("F11", Vector2(1503, 866), 13, GOLD)
	_text("全屏", Vector2(1503, 887), 12, MUTED)
	_hit("fullscreen", Rect2(1485, 837, 100, 60))

func _draw_base():
	_cover("base", Rect2(0, 82, 1190, 754), Color(0.87, 0.89, 0.82))
	# Soft perimeter shade preserves scene detail beneath the command overlay.
	for i in range(70):
		draw_rect(Rect2(0, 82 + i, 1190, 1), Color(0.02, 0.05, 0.05, 0.7 * (1.0 - i / 70.0)))
	_small("FORWARD OPERATING BASE  /  SECTOR 16.16", Vector2(32, 111), 13, GOLD)
	_text("指挥官，欢迎归队", Vector2(31, 151), 28, TEXT, true)
	var goal = "战役已通关：继续建设、采运与升级装甲"
	var destination = "campaign"
	for q in catalog.quests:
		if q.id not in s.claimed:
			goal = q.name + " · " + ("可领取奖励" if s.counters.get(q.counter, 0) >= q.target else q.description)
			destination = "commander"
			break
	_panel(Rect2(24, 667, 770, 49), Color(0.045, 0.075, 0.07, 0.96), LINE)
	_text("下一目标  " + goal, Vector2(39, 697), 16, GOLD)
	_hit("nav:objective", Rect2(24, 667, 770, 49), destination)
	_button("rest:60", "休整 1 小时", Rect2(812, 675, 155, 40), 60)
	_button("rest:480", "休整 8 小时", Rect2(982, 675, 155, 40), 480)
	var hot = [["hq", Vector2(585, 219)], ["lab", Vector2(262, 330)], ["factory", Vector2(944, 344)], ["warehouse", Vector2(611, 532)], ["oil", Vector2(256, 573)], ["iron", Vector2(916, 565)], ["lead", Vector2(1030, 603)], ["titanium", Vector2(855, 175)], ["crystal", Vector2(170, 196)]]
	for pair in hot:
		var id = pair[0]
		var p = pair[1]
		var active = selected_building == id
		var hovered = hover == "building:" + id
		draw_arc(p, 23 + sin(clock * 2) * 2 if active else 12, 0, TAU, 32, GOLD if active else Color(0.9, 0.83, 0.63, 0.5), 2)
		draw_circle(p, 4, GOLD)
		draw_line(p + Vector2(0, 17), p + Vector2(0, 34), GOLD)
		var r = Rect2(p.x - 86, p.y + 32, 172, 33)
		_panel(r, Color(0.07, 0.1, 0.1, 0.95), GOLD if active or hovered else LINE)
		_text(catalog.buildingNames[id], r.position + Vector2(12, 23), 16, GOLD if active else TEXT)
		_small("%02d" % int(s.buildings[id]), r.position + Vector2(142, 22), 17, GOLD)
		_hit("building:" + id, Rect2(p.x - 88, p.y - 40, 176, 108), id)
	# Warm atmospheric motes and a scanning radar ring.
	for i in range(16):
		var x = fmod(i * 91.7 + clock * (3 + i % 4), 1120) + 30
		var y = 180 + fmod(i * 69.3 - clock * 4 + 1200, 570)
		draw_circle(Vector2(x, y), 1 + i % 2, Color(0.95, 0.8, 0.45, 0.2))
	_panel(Rect2(24, 730, 1116, 83), Color(0.045, 0.075, 0.07, 0.96), LINE)
	_small("BASE STATUS", Vector2(42, 753), 12, GOLD)
	_text("自动生产中", Vector2(42, 785), 19, TEXT, true)
	for i in range(5):
		var x = 226 + i * 178
		_icon(i, Rect2(x, 745, 44, 44))
		_text("+%d / 时" % int(info.rates[RES[i]]), Vector2(x + 49, 772), 16)
		_bar(Rect2(x + 49, 784, 90, 3), s.wallet[RES[i]] / info.capacity, GOLD)
		_small("满仓·自产暂停" if s.wallet[RES[i]] >= info.capacity else "容量 %d" % int(info.capacity), Vector2(x + 49, 805), 11, GOLD if s.wallet[RES[i]] >= info.capacity else MUTED)
	_panel(Rect2(1190, 82, 410, 754), Color("111b1c"), LINE)
	var b = selected_building
	var level = int(s.buildings[b])
	_small("FACILITY  /  SELECTED", Vector2(1216, 113), 12, GOLD)
	_text(catalog.buildingNames[b], Vector2(1216, 155), 29, TEXT, true)
	_small("LEVEL %02d" % level, Vector2(1218, 185), 17, GOLD)
	var descriptions = {
		"hq": ["基地的心脏。提升指挥中心等级，", "解锁更先进的设施与装甲部队。"],
		"factory": ["从钢铁到战车。工厂 6 / 12 级", "解锁第二、第三代装甲生产线。"],
		"lab": ["每一次技术突破，", "都会成为战场上的优势。"],
		"warehouse": ["提高资源自然产出的储存上限，", "守住基地的战略储备。"]}
	var lines = descriptions.get(b, ["稳定的物资产出，", "是装甲部队继续前进的保障。"])
	for i in range(lines.size()):
		_text(lines[i], Vector2(1218, 221 + i * 27), 17, MUTED)
	draw_line(Vector2(1218, 274), Vector2(1570, 274), LINE)
	_text("升级至 Lv.%02d" % mini(level + 1, 20), Vector2(1218, 304), 18, GOLD)
	var factor = catalog.costCurve[level]
	var cost = {"iron": (160 if b == "hq" else 90) * factor, "oil": 60 * factor, "lead": 40 * factor}
	_cost(cost, Vector2(1216, 340))
	if b == "lab":
		_cost({"crystal": 30 * factor}, Vector2(1216, 380))
	_text("预计耗时  " + (_time(info.buildingTimes[b]) if level < 20 else "已满级"), Vector2(1218, 418), 20, GOLD)
	var blocked = info.blocks.get(b, "")
	_button("upgrade", "开始升级" if blocked == "" else blocked, Rect2(1218, 433, 350, 44), null, true, blocked == "" and not _command_pending())
	if b == "factory" or b == "lab":
		_button("nav:facility", "进入战车工厂" if b == "factory" else "进入科研中心", Rect2(1218, 488, 350, 36), "factory" if b == "factory" else "research")
	_button("nav:queues", "全部队列 / VIP 容量", Rect2(1218, 782, 350, 35), "queues")
	_job("building", Vector2(1218, 560), 350)
	_job("production", Vector2(1218, 672), 350)

func _find_job(data):
	for j in info.jobs:
		if (data is Dictionary and int(j.seq) == int(data.seq)) or (data is String and j.kind == data and not j.waiting):
			return j
	return {}

func _job(kind, pos: Vector2, width = 480):
	var q = info.queues[kind]
	var titles = {"building": "建设", "production": "生产", "research": "科研", "repair": "维修"}
	var j = _find_job(kind)
	var title = "%s %d/%d" % [titles[kind], q.active, q.slots]
	if q.waitingSlots > 0:
		title += " · 待 %d/%d" % [q.waiting, q.waitingSlots]
	_draw_job_card(j, pos, width, title)

func _draw_job_card(j, pos: Vector2, width, title):
	_panel(Rect2(pos, Vector2(width, 101)), Color("182222"), LINE)
	_text(title, pos + Vector2(13, 23), 14, GOLD)
	if j.is_empty():
		_text("待命中", pos + Vector2(13, 58), 17, MUTED)
		return
	var name = catalog.buildingNames.get(j.target, catalog.techNames.get(j.target, ""))
	if catalog.units.has(j.target):
		name = catalog.units[j.target].name
	_text(name + ("  %d/%d" % [j.completed, j.total] if j.total > 1 else ""), pos + Vector2(13, 48), 15)
	_small(_time(j.remainingMs), pos + Vector2(width - 92, 24), 16, GREEN)
	if j.waiting:
		_text("预计 " + _time(j.waitMs) + " 后开工", pos + Vector2(13, 69), 13, MUTED)
	else:
		_bar(Rect2(pos.x + 13, pos.y + 60, width - 26, 3), 1 - maxf(0, j.dueAt - s.now) / j.duration, GREEN)
	_button("cancel:" + str(int(j.seq)), "取消", Rect2(pos.x + 13, pos.y + 74, 58, 23), {"seq": j.seq}, false, not _command_pending())
	if not j.waiting:
		_button("accelerate:" + str(int(j.seq)), "免费完成" if j.acceleration == 0 else "%d 金币完成" % j.acceleration, Rect2(pos.x + width - 146, pos.y + 74, 134, 23), {"seq": j.seq}, false, s.wallet.gold >= j.acceleration and not _command_pending())

func _draw_queues():
	_title("基地调度中心", "OPERATIONS  /  ACTIVE & WAITING QUEUES")
	_button("nav:vip", "VIP %d · 查看扩容福利" % info.vip.level, Rect2(1255, 111, 307, 47), "vip")
	var kinds = ["building", "production", "research", "repair"]
	var names = ["建筑并行", "生产车间", "科研中心", "维修车间"]
	for i in range(4):
		var q = info.queues[kinds[i]]
		var x = 40 + i * 385
		_panel(Rect2(x, 198, 363, 78))
		_text(names[i] + " %d/%d" % [q.active, q.slots], Vector2(x + 17, 227), 20, GOLD)
		_text("等待 %d/%d" % [q.waiting, q.waitingSlots] if q.waitingSlots > 0 else "可同时施工" if i == 0 else "完成当前批次后接单", Vector2(x + 17, 258), 15, MUTED)
	var pages = maxi(1, ceili(info.jobs.size() / 8.0))
	queue_page = mini(queue_page, pages - 1)
	for i in range(mini(8, info.jobs.size() - queue_page * 8)):
		var j = info.jobs[queue_page * 8 + i]
		var title = names[kinds.find(j.kind)] + (" · 等待开工" if j.waiting else " · 作业中")
		_draw_job_card(j, Vector2(40 + (i % 2) * 775, 297 + int(i / 2.0) * 119), 745, title)
	if info.jobs.is_empty():
		_text("所有车间待命。前往基地、工厂或科研中心安排作业。", Vector2(70, 365), 24, MUTED)
	_text("右上角显示预计完成倒计时；等待项目按顺序开工。已支付资源，取消退回未完成部分。", Vector2(43, 810), 15, MUTED)
	_button("queuePrev", "上一页", Rect2(1260, 783, 130, 37), null, false, queue_page > 0)
	_button("queueNext", "%d/%d 下一页" % [queue_page + 1, pages], Rect2(1404, 783, 156, 37), null, false, queue_page < pages - 1)

func _draw_vip():
	_title("指挥官特权", "VIP  /  OFFLINE BENEFITS")
	var v = info.vip
	_text("VIP %d" % v.level, Vector2(42, 248), 42, GOLD, true)
	_text("累计模拟充值 %d 金币" % v.paidGold, Vector2(229, 233), 20, TEXT)
	_text("已达到最高特权" if v.nextThreshold == null else "距离 VIP %d 还需 %d 金币" % [v.level + 1, v.nextThreshold - v.paidGold], Vector2(229, 265), 16, MUTED)
	_panel(Rect2(40, 292, 981, 469))
	var xs = [57, 137, 291, 417, 557, 701, 845]
	var labels = ["等级", "累计金币", "建筑并行", "生产 / 科研", "行军上限", "免费完成", "每日金币"]
	for i in range(xs.size()):
		_text(labels[i], Vector2(xs[i], 324), 16, GOLD)
	_text("各 1 工作 + 等待位", Vector2(405, 346), 11, MUTED)
	for i in range(catalog.vipLevels.size()):
		var row = catalog.vipLevels[i]
		var y = 371 + i * 34
		if i == int(v.level):
			draw_rect(Rect2(48, y - 23, 965, 32), Color("344132"))
		var values = ["V%d" % i, str(int(row.threshold)), str(int(row.building)), "1 + %d 等待" % row.waiting, str(int(row.marches)), "%d 分钟" % row.freeMinutes, str(int(row.dailyGold))]
		for c in range(xs.size()):
			_text(values[c], Vector2(xs[c], y), 16, TEXT if i <= v.level else MUTED)
	_panel(Rect2(1046, 202, 514, 559), Color("15201e"), GOLD.darkened(0.5))
	_text("当前特权", Vector2(1070, 241), 26, GOLD, true)
	var perks = ["生产速度 +%d%% · 改装速度 +%d%%" % [v.production, v.refit], "科研速度 +%d%% · 行军速度 +%d%%" % [v.research, v.marchSpeed], "战役经验 +%d%% · 仓储容量 +%d%%" % [v.xp, v.storage], "建设 / 科研剩余 ≤ %d 分钟可免费完成" % v.freeMinutes]
	for i in range(perks.size()):
		_text(perks[i], Vector2(1070, 282 + i * 33), 16, TEXT)
	_button("vipDaily", "领取每日 VIP 补给 · %d 金币" % v.dailyGold, Rect2(1068, 407, 470, 43), null, true, v.dailyAvailable and not _command_pending())
	draw_line(Vector2(1068, 474), Vector2(1536, 474), LINE)
	_text("root · 本机管理", Vector2(1070, 511), 24, TEXT, true)
	_text("仅模拟充值，无真实付款。金币及 VIP 随存档保存。", Vector2(1070, 544), 15, MUTED)
	_text("当前档案：" + s.nickname, Vector2(1070, 575), 17, GOLD)
	if info.rootUnlocked:
		_button("rootRecharge", "输入模拟充值金币", Rect2(1068, 600, 470, 44), null, true, not _command_pending())
		_button("rootPassword", "修改密码", Rect2(1068, 660, 220, 39))
		_button("rootLogout", "锁定 root", Rect2(1300, 660, 238, 39))
	else:
		_button("rootLogin", "输入密码解锁 root", Rect2(1068, 600, 470, 44), null, true)
		_text("初始密码见随游戏附带的 README。", Vector2(1070, 682), 15, MUTED)
	_text("参考官网 VIP 1–10：本单机版直接赠送建造位。V10 门槛与每日金币为单机设计。", Vector2(43, 797), 15, MUTED)
	_button("nav:queues", "查看作业队列", Rect2(1275, 781, 284, 37), "queues")

func _draw_sprite_polygon(meta, origin: Vector2, pivot: Vector2, scale_value: float, color = Color.WHITE):
	draw_set_transform(origin, 0, Vector2.ONE * scale_value)
	var silhouette = PackedVector2Array()
	var uv = PackedVector2Array()
	var atlas_size = textures[meta.atlas].get_size()
	for point in meta.hull:
		var local = Vector2(point[0], point[1])
		silhouette.append(local - pivot)
		uv.append((local + Vector2(meta.rect[0], meta.rect[1])) / atlas_size)
	draw_colored_polygon(silhouette, color, uv, textures[meta.atlas])
	draw_set_transform(Vector2.ZERO)

func _draw_factory():
	_title("装甲军械库", "ARSENAL  /  SEVEN GENERATIONS")
	_text("工厂等级  %02d" % int(s.buildings.factory), Vector2(1375, 148), 19, GOLD)
	for i in range(4):
		_button("class:" + str(i), catalog.classNames[CLASSES[i]], Rect2(40 + i * 284, 200, 269, 60), i, selected_class == i)
	for t in range(1, 8):
		_button("tier:" + str(t), ["I  轻型", "II  中型", "III  重型", "IV  进阶", "V  主力", "VI  核心", "VII  精密"][t - 1], Rect2(40 + (t - 1) * 163, 278, 150, 42), t, tier == t)
	var u = catalog.units[_unit_id()]
	var effective = info.unitStats[u.unitId]
	var quote = effective[production_mode]
	_panel(Rect2(40, 339, 615, 434), Color("162020"), LINE)
	_small("GENERATION %02d  /  %s" % [tier, CLASSES[selected_class].to_upper()], Vector2(65, 367), 13, GOLD)
	_text(u.name, Vector2(65, 410), 30, TEXT, true)
	for i in range(8):
		draw_line(Vector2(50 + i * 84, 716), Vector2(350 + (i - 4) * 20, 475), Color(0.6, 0.68, 0.6, 0.06))
	_image(u.unitId, Rect2(63, 417, 568, 284))
	_text("攻击 %d    生命 %d    载重 %d" % [u.attack, u.hp, u.load], Vector2(65, 726), 18, GOLD)
	_text(catalog.classDescriptions[u.classId], Vector2(65, 757), 16, MUTED)
	_panel(Rect2(677, 339, 496, 434), Color("101a1b"), LINE)
	_button("productionMode:produce", "制造新车", Rect2(696, 355, 217, 39), "produce", production_mode == "produce")
	_button("productionMode:refit", "低阶改装", Rect2(926, 355, 227, 39), "refit", production_mode == "refit")
	_text("待命 %d   出征 %d   待修 %d" % [s.available[u.unitId], effective.marching, s.damaged[u.unitId]], Vector2(696, 420), 16, GOLD)
	_text(("消耗 " + catalog.units[quote.sourceUnitId].name + " ×1 / 辆") if quote.sourceUnitId != "" else "生产数量（可直接输入 1–10000）", Vector2(696, 447), 16, MUTED)
	_button("qtyminus", "−", Rect2(696, 465, 40, 42))
	_button("qtyplus", "+", Rect2(872, 465, 40, 42))
	_text("当前最多 %d 辆" % quote.max, Vector2(935, 492), 16, GOLD)
	for i in range(3):
		_button("quantity:" + str(i), str([20, 50, 100][i]), Rect2(696 + i * 116, 520, 105, 39), [20, 50, 100][i])
	_button("quantityMax", "MAX", Rect2(1044, 520, 109, 39))
	_text("预计完成  " + _time(quote.waitMs + quote.duration * quantity), Vector2(696, 590), 21, TEXT, true)
	_text("单辆 " + _time(quote.duration) + " · 等待 " + _time(quote.waitMs) + " · 作业 " + _time(quote.duration * quantity) if quantity > 0 else "请输入 1–10000 的整数数量", Vector2(696, 615), 15, MUTED)
	_cost({"iron": quote.unitCost.get("iron", 0), "oil": quote.unitCost.get("oil", 0), "lead": quote.unitCost.get("lead", 0)}, Vector2(696, 650), quantity)
	_cost({"titanium": quote.unitCost.get("titanium", 0), "crystal": quote.unitCost.get("crystal", 0)}, Vector2(696, 687), quantity)
	if quote.has("coreCost"):
		var core_id = quote.coreCost.id
		_image("core_" + u.classId, Rect2(949, 661, 33, 33))
		_text("核心 %d / %d" % [s.arsenal.cores[core_id], quantity], Vector2(986, 686), 16, GOLD if s.arsenal.cores[core_id] >= quantity else RED)
	var label = quote.block if quote.block != "" else "等待位已满" if quote.busy else "加入等待队列" if quote.waitMs > 0 else ("开始改装" if production_mode == "refit" else "投入生产")
	_button("produce", label, Rect2(696, 713, 272, 43), null, true, quote.block == "" and quantity > 0 and quantity <= quote.max and not quote.busy and not _command_pending())
	_button("repair", "修复 %d 辆" % quantity, Rect2(981, 713, 172, 43), null, false, quantity > 0 and quantity <= effective.repair.max and not effective.repair.busy and not _command_pending())
	_panel(Rect2(1202, 199, 360, 574), Color("121c1d"), LINE)
	_text("后勤调度", Vector2(1224, 237), 22, TEXT, true)
	_job("production", Vector2(1218, 259), 327)
	_job("repair", Vector2(1218, 380), 327)
	_text("核心储备", Vector2(1224, 529), 18, GOLD)
	for i in range(2):
		var core_id = u.classId + "_core" + str(i + 6)
		_image("core_" + u.classId, Rect2(1224, 545 + i * 52, 42, 42))
		_text(catalog.coreNames[core_id], Vector2(1276, 567 + i * 52), 16, TEXT)
		_small("×%d" % s.arsenal.cores[core_id], Vector2(1494, 568 + i * 52), 18, GOLD)
	_text("取消：退回未完成的资源、核心与原车。", Vector2(1224, 678), 14, MUTED)
	_text("修复预计 " + _time(effective.repair.duration * quantity) + (" · 车间忙" if effective.repair.busy else ""), Vector2(1224, 713), 15, GOLD)
	_cost(u.repairCost, Vector2(1220, 747), quantity)
	_button("nav:queues", "查看全部作业队列", Rect2(310, 786, 270, 33), "queues")
	_button("coreDungeons", "前往核心副本", Rect2(40, 786, 249, 33))
	_button("unitGuide", "兵种图鉴 / 克制 / 实际属性", Rect2(1202, 786, 360, 33))

func _draw_army():
	_title("作战编队", "BATTLE GROUP  /  SIX POSITION DOCTRINE")
	_text("单格上限  %d 辆" % int(info.leadership), Vector2(1360, 148), 19, GOLD)
	_text("前排  /  FRONT LINE", Vector2(47, 219), 16, GOLD)
	for i in range(6):
		var p = Vector2(40 + (i % 3) * 279, 236 + int(i / 3.0) * 243)
		var active = selected_slot == i
		_panel(Rect2(p, Vector2(265, 219)), Color("232e28") if active else Color("151f20"), GOLD if active else LINE)
		_small("0" + str(i + 1), p + Vector2(15, 28), 20, GOLD)
		_small("COLUMN " + str(i % 3 + 1), p + Vector2(168, 24), 11)
		var st = draft[i] if draft.size() == 6 else null
		if st != null:
			var unit = catalog.units[st.unitId]
			_image(unit.unitId, Rect2(p + Vector2(13, 29), Vector2(240, 150)))
			_text(unit.name, p + Vector2(16, 198), 17)
			_small("×" + str(int(st.count)), p + Vector2(203, 198), 22, GOLD)
		else:
			_small("+", p + Vector2(112, 117), 44, LINE.lightened(0.3))
			_text("选择右侧战车部署", p + Vector2(52, 179), 15, MUTED)
		_hit("slot:" + str(i), Rect2(p, Vector2(265, 219)), i)
	_text("后排  /  SUPPORT LINE", Vector2(47, 473), 14, GOLD)
	_button("formationAuto", "自动满编", Rect2(40, 725, 147, 47))
	_button("formationSave", "保存编队" + (" *" if dirty else ""), Rect2(201, 725, 167, 47), null, true, not _command_pending())
	_button("presetSave", "保存预设", Rect2(382, 725, 144, 47))
	_button("slotclear", "清空阵位", Rect2(540, 725, 141, 47))
	_button("slotminus", "−", Rect2(695, 725, 55, 47))
	_button("slotplus", "+", Rect2(762, 725, 55, 47))
	_text("点击阵位后部署战车；拖动阵位可交换位置。", Vector2(42, 802), 16, MUTED)
	_panel(Rect2(906, 199, 654, 596), Color("111b1c"), LINE)
	_text("待命装甲", Vector2(929, 236), 24, TEXT, true)
	_small("RESERVE  /  SELECT TO DEPLOY", Vector2(929, 262), 12, GOLD)
	for i in range(mini(12, catalog.unitList.size() - reserve_page * 12)):
		var unit = catalog.unitList[reserve_page * 12 + i]
		var p = Vector2(925 + (i % 3) * 207, 282 + int(i / 3.0) * 108)
		var enabled = s.available[unit.unitId] > 0
		_panel(Rect2(p, Vector2(195, 98)), Color("243129") if hover == "assign:" + unit.unitId else Color("182221"), LINE)
		_image(unit.unitId, Rect2(p.x + 2, p.y + 3, 102, 63), Color.WHITE if enabled else Color(0.35, 0.4, 0.38))
		_small("%02d" % int(s.available[unit.unitId]), p + Vector2(132, 47), 23, GOLD if enabled else MUTED)
		_text(unit.name, p + Vector2(9, 86), 14, TEXT if enabled else MUTED)
		_hit("assign:" + unit.unitId, Rect2(p, Vector2(195, 98)), unit.unitId)
	_button("reservePrev", "上一页", Rect2(1285, 217, 108, 38), null, false, reserve_page > 0)
	_button("reserveNext", "%d / %d  下一页" % [reserve_page + 1, int(ceil(catalog.unitList.size() / 12.0))], Rect2(1400, 217, 144, 38))
	for i in range(s.presets.size()):
		_button("presetLoad:" + str(i), s.presets[i].name.substr(0, 6), Rect2(925 + i * 122, 737, 114, 36), i)

func _draw_research():
	_title("科研中心", "RESEARCH BUREAU  /  TECHNOLOGICAL ADVANTAGE")
	_text("科研等级  %02d" % int(s.buildings.lab), Vector2(1360, 148), 19, GOLD)
	var keys = ["attack", "hp", "production", "construction", "gather"]
	for i in range(5):
		var key = keys[i]
		var level = int(s.tech[key])
		var p = Vector2(40, 205 + i * 109)
		_panel(Rect2(p, Vector2(1054, 96)), Color("152020"), LINE)
		_small("0" + str(i + 1), p + Vector2(20, 41), 24, GOLD)
		_text(catalog.techNames[key], p + Vector2(84, 37), 21, TEXT, true)
		_text(["攻击", "生命", "生产 / 维修速度", "建造速度", "采集速度"][i] + " +%d%% → +%d%%" % [level * 5, mini(20, level + 1) * 5], p + Vector2(84, 69), 15, MUTED)
		_small("LV.%02d" % level, p + Vector2(330, 43), 25, GOLD)
		_bar(Rect2(p.x + 330, p.y + 62, 110, 4), level / 20.0, GOLD)
		_cost({"iron": 100 * (level + 1), "lead": 80 * (level + 1), "crystal": 30 * (level + 1)}, p + Vector2(481, 53))
		var q = info.researchQuotes[key]
		var estimate = "耗时 " + _time(q.duration) + " · 等待 " + _time(q.waitMs)
		if q.booked != null:
			estimate = ("等待 " + _time(q.booked.waitMs) + " · " if q.booked.waiting else "作业中 · ") + "预计完成 " + _time(q.booked.remainingMs)
		_text(estimate, p + Vector2(481, 82), 14, GOLD)
		_button("research:" + key, "已排队" if q.duplicate else "加入队列" if q.waitMs > 0 else "开始研究", Rect2(p.x + 826, p.y + 24, 200, 48), key, true, not info.queues.research.full and not q.duplicate and level < mini(20, s.buildings.lab) and not _command_pending())
	_panel(Rect2(1123, 205, 437, 532), Color("111b1c"), LINE)
	_text("研究计划", Vector2(1147, 247), 24, TEXT, true)
	_button("nav:queues", "管理队列", Rect2(1400, 219, 142, 37), "queues")
	_job("research", Vector2(1140, 271), 402)
	_image("tank_destroyer", Rect2(1150, 400, 380, 224), Color(0.85, 0.9, 0.78))
	_text("科技等级受科研中心等级限制。", Vector2(1145, 664), 18, MUTED)
	_text("已出征部队保留出发时的属性。", Vector2(1145, 698), 18, MUTED)

func _draw_campaign():
	if campaign_mode == "dungeon":
		_draw_dungeons()
		return
	_button("campaignMode:dungeon", "核心副本 →", Rect2(40, 776, 239, 39), "dungeon")
	_title("钢铁远征", "CAMPAIGN  /  OPERATION DAWN")
	_text("战役进度  %02d / 12" % s.cleared.size(), Vector2(1310, 148), 20, GOLD)
	for i in range(12):
		var p = Vector2(40 + (i % 3) * 281, 207 + int(i / 3.0) * 141)
		var cleared = info.stageStatus[i].cleared
		var unlocked = info.stageStatus[i].unlocked
		_panel(Rect2(p, Vector2(264, 123)), Color("343a2b") if selected_stage == i else Color("172222"), GOLD if selected_stage == i else LINE)
		_small("%02d" % (i + 1), p + Vector2(17, 33), 26, GOLD if unlocked else MUTED)
		_small("CLEARED" if cleared else "AVAILABLE" if unlocked else "LOCKED", p + Vector2(152, 29), 11, GREEN if cleared else MUTED)
		_text(catalog.stageNames[i], p + Vector2(18, 75), 24, TEXT if unlocked else MUTED, true)
		_text("已占领" if cleared else "等待突破" if unlocked else "前线尚未推进", p + Vector2(18, 104), 14, GREEN if cleared else MUTED)
		_hit("stage:" + str(i), Rect2(p, Vector2(264, 123)), i)
	_panel(Rect2(907, 207, 653, 546), Color("111b1c"), LINE)
	var stage = catalog.stages[selected_stage]
	_small("MISSION BRIEFING  /  %02d" % (selected_stage + 1), Vector2(932, 242), 14, GOLD)
	_text(stage.name, Vector2(932, 290), 35, TEXT, true)
	_text(stage.hint, Vector2(932, 328), 18, MUTED)
	_text("守军部署", Vector2(932, 378), 18, GOLD)
	_mini_formation(stage.formation, Vector2(928, 395), Vector2(190, 100))
	var rewards = stage.reward.duplicate()
	if info.stageStatus[selected_stage].cleared:
		for r in rewards:
			rewards[r] = 0 if r == "gold" else int(floor(rewards[r] * 0.2))
	_text("重复挑战物资" if info.stageStatus[selected_stage].cleared else "首次占领物资", Vector2(933, 625), 17, GOLD)
	_cost(rewards, Vector2(929, 662))
	_button("training", "战术演习 · 无战损", Rect2(929, 691, 270, 43), null, false, not _command_pending())
	var unlocked = info.stageStatus[selected_stage].unlocked
	_button("attack", "发起进攻", Rect2(1215, 691, 319, 43), null, true, unlocked and not _command_pending())
	_text("演习不解锁关卡、不发奖励；正式进攻胜利推进战役。", Vector2(908, 789), 16, MUTED)

func _draw_dungeons():
	_title("核心行动", "CORE OPERATIONS  /  REPEATABLE SOLO MISSIONS")
	_button("campaignMode:stage", "← 经典战役", Rect2(1331, 119, 231, 44), "stage")
	for i in range(catalog.dungeons.size()):
		var dungeon = catalog.dungeons[i]
		var p = Vector2(40 + (i % 2) * 426, 207 + int(i / 2.0) * 141)
		var cleared = dungeon.id in s.arsenal.cleared
		var unlocked = s.buildings.factory >= dungeon.factoryLevel
		_panel(Rect2(p, Vector2(410, 123)), Color("343a2b") if selected_dungeon == i else Color("172222"), GOLD if selected_dungeon == i else LINE)
		_image("core_" + catalog.coreList[i].classId, Rect2(p + Vector2(13, 16), Vector2(82, 82)))
		_text(dungeon.name, p + Vector2(107, 36), 20, TEXT if unlocked else MUTED, true)
		_text("稳定掉落 %d 个 · 工厂 %d 级" % [dungeon.repeatReward if cleared else dungeon.firstReward, dungeon.factoryLevel], p + Vector2(107, 70), 16, GOLD)
		_text("可重复挑战" if unlocked else "升级工厂解锁；可先演习", p + Vector2(107, 102), 14, MUTED)
		_hit("dungeon:" + str(i), Rect2(p, Vector2(410, 123)), i)
	var d = catalog.dungeons[selected_dungeon]
	var cleared = d.id in s.arsenal.cleared
	_panel(Rect2(907, 207, 653, 546), Color("111b1c"), LINE)
	_text(d.name, Vector2(932, 255), 30, TEXT, true)
	_text("突破守军，回收高阶战车制造与改装核心。", Vector2(932, 294), 18, MUTED)
	_text("守军部署", Vector2(932, 340), 18, GOLD)
	_mini_formation(d.formation, Vector2(928, 362), Vector2(190, 100))
	_image("core_" + catalog.coreList[selected_dungeon].classId, Rect2(934, 595, 54, 54))
	_text(catalog.coreNames[d.coreId] + " ×%d" % (d.repeatReward if cleared else d.firstReward), Vector2(1005, 626), 22, GOLD, true)
	_text("库存 %d · 首胜 %d 个，此后每胜 %d 个" % [s.arsenal.cores[d.coreId], d.firstReward, d.repeatReward], Vector2(933, 666), 17, MUTED)
	_button("dungeonTraining", "战术演习 · 无战损", Rect2(929, 691, 270, 43), null, false, not _command_pending())
	_button("dungeonAttack", "发起核心行动", Rect2(1215, 691, 319, 43), null, true, s.buildings.factory >= d.factoryLevel and not _command_pending())
	_text("胜利必得核心，无每日次数限制。正式挑战结算战损；演习无掉落。", Vector2(40, 800), 17, MUTED)

func _mini_formation(formation, pos: Vector2, cell: Vector2):
	for i in range(6):
		var p = pos + Vector2(i % 3, int(i / 3.0)) * (cell + Vector2(7, 7))
		_panel(Rect2(p, cell), Color("1a2523"), LINE)
		_small(str(i + 1), p + Vector2(7, 18), 12, GOLD)
		if formation[i] != null:
			var st = formation[i]
			_image(st.unitId, Rect2(p + Vector2(16, 1), Vector2(cell.x - 28, cell.y - 21)))
			_text(catalog.units[st.unitId].name + " ×" + str(int(st.count)), p + Vector2(10, cell.y - 8), 12, TEXT)

func _site():
	for site in s.world:
		if site.id == selected_site:
			return site
	return s.world[0]

func _draw_world():
	_title("世界行动", "STRATEGIC OPERATIONS  /  SECTOR MAP")
	_text("远征队列  %d / %d" % [s.marches.size(), info.vip.marches], Vector2(1350, 148), 19, GOLD)
	_panel(Rect2(40, 202, 974, 591), Color("1c2924"), LINE)
	_button("mapSearch", "坐标定位", Rect2(61, 208, 136, 32))
	_button("mapHome", "我的基地", Rect2(206, 208, 136, 32))
	_button("mapSelected", "当前目标", Rect2(351, 208, 136, 32))
	_button("mapZoomOut", "−", Rect2(500, 208, 45, 32))
	_button("mapZoomIn", "+", Rect2(554, 208, 45, 32))
	_small("%.1f×  滚轮缩放 / 右键拖动" % map_zoom, Vector2(615, 230), 14, GOLD)
	if textures.has("worldmap"):
		var tex = textures.worldmap
		var extent = Vector2.ONE * (32.0 / map_zoom)
		var region = Rect2((map_center - extent / 2.0) / 32.0 * tex.get_size(), extent / 32.0 * tex.get_size())
		draw_texture_rect_region(tex, MAP_RECT, region, Color(0.72, 0.8, 0.72))
	for i in range(33):
		var p = _map_point(Vector2(i, i))
		if p.x >= MAP_RECT.position.x and p.x <= MAP_RECT.end.x:
			draw_line(Vector2(p.x, MAP_RECT.position.y), Vector2(p.x, MAP_RECT.end.y), Color(0.8, 0.9, 0.8, 0.075))
		if p.y >= MAP_RECT.position.y and p.y <= MAP_RECT.end.y:
			draw_line(Vector2(MAP_RECT.position.x, p.y), Vector2(MAP_RECT.end.x, p.y), Color(0.8, 0.9, 0.8, 0.075))
	var home = _map_point(Vector2(s.home.x + 0.5, s.home.y + 0.5))
	if MAP_RECT.grow(-30).has_point(home):
		draw_arc(home, 22 + sin(clock * 1.6) * 2, 0, TAU, 48, GOLD, 1.5, true)
		draw_circle(home, 8, GOLD)
		_text("基地", home + Vector2(13, -7), 15, GOLD)
	for m in s.marches:
		for target in s.world:
			if target.id == m.targetId:
				var end = _map_point(Vector2(target.x + 0.5, target.y + 0.5))
				if not MAP_RECT.has_point(home) or not MAP_RECT.has_point(end):
					continue
				draw_dashed_line(home, end, GOLD, 1.4, 5, true)
				var p = clampf((s.now - m.startedAt) / maxf(1, m.dueAt - m.startedAt), 0, 1)
				if m.phase == "returning":
					p = 1 - p
				elif m.phase == "gathering":
					p = 1
				draw_circle(home.lerp(end, p), 4, Color("f5e9b6"))
	for site in s.world:
		var p = _map_point(Vector2(site.x + 0.5, site.y + 0.5))
		if not MAP_RECT.has_point(p):
			continue
		var col = RED if site.kind == "npc" else GREEN if site.reserve > 0 else MUTED
		if site.id == selected_site:
			draw_arc(p, 17, 0, TAU, 32, GOLD, 2, true)
		if site.kind == "npc":
			draw_circle(p, 10, Color(0.18, 0.08, 0.05, 0.9))
			draw_colored_polygon(PackedVector2Array([p + Vector2(0, -6), p + Vector2(6, 0), p + Vector2(0, 6), p + Vector2(-6, 0)]), col)
		else:
			draw_circle(p, 11, Color(0.03, 0.08, 0.065, 0.87))
			_icon(RES.find(site.resource), Rect2(p - Vector2(11, 11), Vector2(22, 22)))
		_small(str(int(site.level)), p + Vector2(10, 4), 10, TEXT)
		_hit("site:" + site.id, Rect2(p - Vector2(12, 8), Vector2(24, 16)), site.id)
	_text("中心 [%02d,%02d]   矿点每小时补充；据点自产并消耗资源重建；基地安全。" % [map_center.x, map_center.y], Vector2(68, 780), 14, MUTED)
	var site = _site()
	_panel(Rect2(1040, 202, 520, 367), Color("131e1e"), LINE)
	_icon(RES.find(site.resource), Rect2(1056, 217, 83, 83))
	_text(site.name, Vector2(1149, 250), 27, TEXT, true)
	_small("LV.%d  /  [%02d, %02d]" % [site.level, site.x, site.y], Vector2(1151, 280), 17, GOLD)
	var mq = info.marchQuotes[site.id]
	_text("去程 " + _time(mq.outboundMs) + " · 返程 " + _time(mq.returnMs), Vector2(1063, 316), 16, GOLD)
	_text("采集 " + _time(mq.gatherMs) + " · 全程约 " + _time(mq.totalMs), Vector2(1063, 343), 16, GOLD)
	var intel = s.intel.get(site.id)
	var guards = 0
	if intel != null:
		for st in intel.guards:
			if st != null:
				guards += int(st.count)
	_text("侦察守军 %d 辆 · %s 前" % [guards, _time(s.now - intel.at)] if intel != null else "守军未知 · 建议先侦察", Vector2(1063, 374), 16, TEXT)
	_text("预计采集 %d · 运力 %d · %d/小时" % [mq.amount, mq.load, mq.gatherRate] if site.kind == "mine" else "突袭无采集等待，到达后战斗并返航", Vector2(1063, 403), 15, MUTED)
	if site.kind == "mine":
		_text("矿储 %d/%d · 下次补给 %s" % [site.reserve, info.mineCaps[site.id], _time(site.lastGrowth + info.worldInterval - s.now)], Vector2(1063, 430), 14, MUTED)
	elif intel != null:
		_text("情报物资 " + _cost_text(intel.wallet), Vector2(1063, 430), 11, MUTED)
	_text("全程按现有矿量、无战损估算；实际随战况变化。", Vector2(1063, 557), 13, MUTED)
	_button("scout", "侦察 · 3 水晶", Rect2(1062, 445, 473, 37), null, false, not _command_pending())
	_button("gather" if site.kind == "mine" else "raid", "出征采集" if site.kind == "mine" else "突袭据点", Rect2(1062, 496, 473, 43), null, true, s.marches.size() < info.vip.marches and mq.load > 0 and not _command_pending())
	march_page = mini(march_page, maxi(0, ceili(s.marches.size() / 2.0) - 1))
	for i in range(2):
		var y = 589 + i * 104
		var index = march_page * 2 + i
		_panel(Rect2(1040, y, 520, 96), Color("172322"), LINE)
		if index >= s.marches.size():
			_text("远征队 · 待命", Vector2(1060, y + 48), 18, MUTED)
			continue
		var m = s.marches[index]
		var phase = {"outbound": "前往目标", "gathering": "采集中", "returning": "返回基地"}[m.phase]
		var cargo = 0
		for r in RES:
			cargo += int(m.cargo[r])
		var home_ms = maxf(0, m.dueAt - s.now)
		if m.phase == "gathering":
			home_ms += m.travelMs
		elif m.phase == "outbound":
			var reserve = 0
			for target in s.world:
				if target.id == m.targetId:
					reserve = target.reserve
			home_ms += m.travelMs + (ceil(minf(m.capacity, reserve) * 3600000.0 / m.gatherRate) if m.mission == "gather" else 0)
		_text(phase + " · 本段 " + _time(m.dueAt - s.now), Vector2(1060, y + 26), 16, GOLD)
		_text("载货 %d/%d · 预计回城 %s" % [cargo, m.capacity, _time(home_ms)], Vector2(1060, y + 54), 15, MUTED)
		_text("回城后物资入库 · 召回将提前结束采集", Vector2(1060, y + 80), 12, MUTED)
		_button("recall:" + m.id, "召回", Rect2(1454, y + 22, 84, 39), m.id, false, m.phase != "returning")
	_button("marchNext", "远征列表 %d/%d · 下一页" % [march_page + 1, maxi(1, ceili(s.marches.size() / 2.0))], Rect2(1220, 797, 340, 30), null, false, s.marches.size() > 2)

func _draw_commander():
	_title("指挥官档案", "OFFICER DOSSIER  /  HONOR & DUTY")
	_panel(Rect2(40, 205, 460, 560), Color("172220"), LINE)
	_image("emblem", Rect2(154, 220, 232, 190))
	_text(s.nickname, Vector2(76, 439), 34, TEXT, true)
	_text(info.rank + "    Lv." + str(int(info.level)), Vector2(78, 479), 21, GOLD)
	_text("作战经验  %d" % int(s.commander.xp), Vector2(78, 524), 18, MUTED)
	_text("军功声望  %d" % int(s.commander.prestige), Vector2(78, 560), 18, MUTED)
	var daily_ready = int(floor((s.now + 28800000) / 86400000.0)) > s.lastDaily
	_button("daily", "领取每日补给" if daily_ready else "今日补给已领取", Rect2(75, 610, 389, 47), null, true, daily_ready and not _command_pending())
	_button("rename", "编辑指挥官名称", Rect2(75, 679, 389, 43))
	_panel(Rect2(530, 205, 1030, 146), Color("172220"), LINE)
	_text("统率能力", Vector2(553, 242), 23, TEXT, true)
	_text("等级 %d   每格 %d 辆   统率书 %d" % [s.commander.leadership, info.leadership, s.commander.books], Vector2(553, 279), 18, MUTED)
	_button("leadership", "提升统率 · %d 本" % int(s.commander.leadership), Rect2(552, 299, 270, 36), null, true, s.commander.books >= s.commander.leadership and s.commander.leadership < 20 and not _command_pending())
	_text("进攻技能", Vector2(1070, 242), 23, TEXT, true)
	_text("攻击 +%d%%   技能点 %d" % [s.commander.attackSkill * 2, s.commander.skillPoints], Vector2(1070, 279), 18, MUTED)
	_button("skill", "提升攻击 · 1 点", Rect2(1070, 299, 268, 36), null, true, s.commander.skillPoints > 0 and s.commander.attackSkill < 20 and not _command_pending())
	_text("战地任务", Vector2(533, 395), 25, TEXT, true)
	_button("questNext", "切换任务页  %d / 2" % (quest_page + 1), Rect2(1345, 365, 214, 39))
	for i in range(5):
		var q = catalog.quests[quest_page * 5 + i]
		var done = q.id in s.claimed
		var count = int(s.counters.get(q.counter, 0))
		var p = Vector2(530, 422 + i * 73)
		_panel(Rect2(p, Vector2(1030, 64)), Color("152020"), LINE)
		_text(q.name, p + Vector2(17, 28), 18, TEXT, true)
		_text(q.description, p + Vector2(17, 52), 14, MUTED)
		_cost(q.reward, p + Vector2(410, 36))
		_button("claim:" + q.id, "已领取" if done else "领取" if count >= q.target else "%d / %d" % [count, q.target], Rect2(p.x + 886, p.y + 14, 125, 36), q.id, not done and count >= q.target, not done and count >= q.target and not _command_pending())

func _draw_reports():
	_title("战地档案", "AFTER ACTION REPORTS  /  TACTICAL REPLAY")
	_text("保留最近 100 场战斗", Vector2(1326, 148), 18, MUTED)
	if s.reports.is_empty():
		_image("tank", Rect2(500, 280, 580, 310), Color(0.5, 0.58, 0.48))
		_text("战地档案等待你的第一场战斗。", Vector2(570, 653), 23, MUTED)
	for i in range(6):
		var index = report_page * 6 + i
		if index >= s.reports.size():
			break
		var r = s.reports[index]
		var p = Vector2(40, 205 + i * 88)
		_panel(Rect2(p, Vector2(1520, 75)), Color("162221"), LINE)
		_text("胜利" if r.winner == 0 else "失利", p + Vector2(20, 45), 23, GREEN if r.winner == 0 else RED, true)
		_text(r.title, p + Vector2(123, 32), 21, TEXT, true)
		_text("演习" if r.mode == "training" else "世界战斗" if r.mode == "world" else "战役进攻", p + Vector2(124, 58), 14, MUTED)
		_small("%d ROUNDS" % int(r.rounds), p + Vector2(523, 44), 18, GOLD)
		_cost(r.rewards, p + Vector2(700, 44))
		_button("report:" + r.id, "战斗回放", Rect2(p.x + 1317, p.y + 16, 180, 43), r.id, true)
	_button("reportsPrev", "上一页", Rect2(1170, 755, 122, 43))
	_text("%d / %d" % [report_page + 1, maxi(1, int(ceil(s.reports.size() / 6.0)))], Vector2(1318, 783), 19, GOLD)
	_button("reportsNext", "下一页", Rect2(1415, 755, 144, 43))

func _draw_settings():
	_title("存档管理与设置", "LOCAL SAVES  /  WINDOWS EDITION")
	_panel(Rect2(40, 205, 740, 578), Color("152020"), LINE)
	_text("本地存档", Vector2(66, 246), 27, TEXT, true)
	_text("当前档案：" + s.nickname, Vector2(66, 289), 20, GOLD)
	var saved_at = Time.get_datetime_string_from_unix_time(int(info.get("savedAt", 0) / 1000) + 28800, true)
	_text("已开启自动保存 · 最近落盘 " + saved_at, Vector2(66, 328), 15, MUTED)
	_button("save", "立即保存  F5", Rect2(65, 350, 209, 44), null, true, not _command_pending())
	_button("copy", "另存为副本", Rect2(295, 350, 209, 44), null, false, not _command_pending())
	_button("rename", "重命名当前档", Rect2(525, 350, 225, 44), null, false, not _command_pending())
	_button("export", "导出存档 JSON", Rect2(65, 410, 209, 44), null, false, not _command_pending())
	_button("import", "导入为新存档", Rect2(295, 410, 209, 44), null, false, not _command_pending())
	_button("restore", "恢复备份", Rect2(525, 410, 225, 44), null, false, info.get("hasBackup", false) and not _command_pending())
	_button("new", "新建存档 · 从头开始", Rect2(65, 470, 328, 44), null, false, not _command_pending())
	_button("savefolder", "打开存档文件夹", Rect2(414, 470, 336, 44))
	_button("nav:vip", "VIP 福利 / root 管理", Rect2(432, 525, 318, 40), "vip")
	_text("原生窗口", Vector2(66, 550), 23, TEXT, true)
	_button("fullscreen", "切换全屏  F11", Rect2(65, 579, 329, 45))
	_button("sound", "音效：关闭" if muted else "音效：开启", Rect2(414, 579, 336, 45))
	_text("导入与副本均保留原档；F5 同时保存正在编辑的编队。", Vector2(66, 657), 16, MUTED)
	_text("未使用的存档也会在下次载入时结算离线进度。", Vector2(66, 682), 16, MUTED)
	_text("游戏时间（上海） " + Time.get_datetime_string_from_unix_time(int(s.now / 1000) + 28800, true), Vector2(66, 705), 15, MUTED)
	_text("经典单机重制 · 原创素材 · 规则数值为原型设计", Vector2(66, 732), 17, GOLD)
	_panel(Rect2(811, 205, 749, 578), Color("111b1c"), LINE)
	_text("选择存档  ·  %d 个" % saves.size(), Vector2(837, 246), 26, TEXT, true)
	for i in range(7):
		if save_page * 7 + i >= saves.size():
			break
		var item = saves[save_page * 7 + i]
		var y = 274 + i * 68
		_panel(Rect2(835, y, 702, 57), Color("192522"), LINE)
		_text(item.nickname, Vector2(854, y + 24), 18, TEXT, true)
		_small("#" + item.id.substr(0, 8), Vector2(1185, y + 23), 13, GOLD)
		var timestamp = Time.get_datetime_string_from_unix_time(int(item.get("savedAt", item.at) / 1000) + 28800, true)
		_small(timestamp + "  ·  指挥部 %d 级  ·  关卡 %d/12" % [item.get("hq", 1), item.get("cleared", 0)], Vector2(854, y + 46), 12, MUTED)
		if item.get("recoverable", false):
			_small("可恢复", Vector2(1295, y + 24), 13, GOLD)
		_button("load:" + item.id, "当前" if item.id == s.id else "载入", Rect2(1391, y + 9, 125, 38), item.id, item.id == s.id, item.id != s.id and not _command_pending())
	if saves.size() > 7:
		_button("savesPrev", "上一页", Rect2(1190, 749, 140, 29))
		_button("savesNext", "下一页", Rect2(1350, 749, 187, 29))

func open_report(value):
	_stop_battle_audio()
	battle_audio_events.clear()
	report = value
	battle_armies = report.initial.duplicate(true)
	battle_index = 0
	battle_time = 0
	battle_clock = 0
	battle_deaths = {}
	battle_aims = {}
	battle_volley = []
	pending_hit = false
	battle_paused = false
	last_hit = {}
	toast_until = 0
	screen = "battle"

func _battle_step(delta):
	# Keep action boundaries even when one rendered frame spans several actions at x4.
	var remaining = delta * battle_speed
	while remaining > 0.000001:
		if _battle_done():
			battle_clock = _battle_end_time()
			break
		var step = minf(remaining, 0.025)
		remaining -= step
		battle_clock += step
		battle_time += step
		if pending_hit and battle_clock - hit_time >= 0.32:
			_apply_hit()
		if battle_time >= 1.05 and battle_index < report.events.size():
			battle_time -= 1.05
			_play_hit()
	if _battle_done():
		battle_clock = _battle_end_time()

func _play_hit():
	last_hit = report.events[battle_index]
	hit_time = battle_clock - battle_time
	pending_hit = true
	battle_volley = []
	# A rocket barrage / piercing gun shot is one action with multiple target events.
	while battle_index < report.events.size():
		var e = report.events[battle_index]
		if e.round != last_hit.round or e.side != last_hit.side or e.from != last_hit.from:
			break
		battle_volley.append(e)
		battle_index += 1
	battle_aims["%d:%d" % [last_hit.side, last_hit.from]] = _battle_position(1 - int(last_hit.side), int(last_hit.to)) - Vector2(0, 20)
	_battle_sound(_volley_class(), "fire")

func _apply_hit():
	for e in battle_volley:
		for st in battle_armies[1 - int(e.side)]:
			if st.slot == e.to:
				if st.totalHp > 0 and e.hp <= 0:
					var side = 1 - int(e.side)
					var at = hit_time + 0.32
					battle_deaths["%d:%d" % [side, int(e.to)]] = {"at": at, "side": side, "slot": int(e.to), "unitId": st.unitId, "position": _alive_position(side, int(e.to), at)}
				st.totalHp = e.hp
				st.count = e.remaining
	pending_hit = false
	if battle_volley.any(func(e): return not e.miss):
		_battle_sound(_volley_class(), "impact")


# The ground UVs and stationary world objects share one displacement function.
# Texture motion = negative UV motion times the texture's projected size.
func _ground_displacement(side: int, elapsed: float) -> Vector2:
	return Vector2(-760 * 0.7, 507 * 0.39) * 0.06 * elapsed * (1 if side == 0 else -1)

func _alive_position(side: int, slot: int, at: float) -> Vector2:
	var heading = Vector2(1, -0.55).normalized() * (1 if side == 0 else -1)
	return _battle_position(side, slot) + heading * sin(at * 3.4 + slot * 1.7) * 2.2 + Vector2(0, sin(at * 17 + slot * 2) * 0.65)

func _unit_position(side: int, slot: int) -> Vector2:
	var death = battle_deaths.get("%d:%d" % [side, slot], {})
	if not death.is_empty():
		return death.position + _ground_displacement(side, maxf(0, battle_clock - death.at))
	return _alive_position(side, slot, battle_clock)

func _battle_end_time() -> float:
	var end = hit_time + 0.96 if not last_hit.is_empty() else 0.0
	for death in battle_deaths.values():
		end = maxf(end, death.at + 1.65)
	return end

func _seek_battle_end():
	var speed = battle_speed
	open_report(report)
	suppress_battle_audio = true
	battle_speed = 1
	# Reconstruct deaths from historical events as normal playback does. Never recalculate combat.
	_battle_step(10000)
	suppress_battle_audio = false
	battle_speed = speed
	battle_volley = []
	battle_aims = {}
	_stop_battle_audio()

func _volley_class() -> String:
	for st in report.initial[int(last_hit.side)]:
		if st.slot == last_hit.from:
			return catalog.units[st.unitId].classId
	return "tank"

func _battle_sound(cls: String, phase: String):
	if suppress_battle_audio or muted:
		return
	var key = cls + "_" + phase
	if not battle_audio.has(key):
		return
	if test_mode:
		battle_audio_events.append({"key": key, "at": battle_clock})
	var voice: AudioStreamPlayer = battle_voices[0]
	for candidate in battle_voices:
		if not candidate.playing:
			voice = candidate
			break
	voice.stream = battle_audio[key]
	voice.volume_db = -8.0 if phase == "fire" else -11.0
	voice.pitch_scale = 1.0 + (battle_speed - 1.0) * 0.045
	voice.play()
	voice.stream_paused = battle_paused

func _stop_battle_audio():
	for voice in battle_voices:
		voice.stop()

func _sync_battle_audio():
	if screen != "battle" or muted:
		_stop_battle_audio()
	else:
		for voice in battle_voices:
			voice.stream_paused = battle_paused

func _battle_pose(unit_id, side, slot):
	var key = unit_id + ("_ne" if side == 0 else "_sw")
	var meta = battle_sprite_meta[key]
	var pivot = Vector2(meta.pivot[0], meta.pivot[1])
	var muzzle = Vector2(meta.muzzle[0], meta.muzzle[1])
	var p = _alive_position(side, slot, battle_clock) - Vector2(0, 20)
	var target = battle_aims.get("%d:%d" % [side, slot], p + Vector2(500, -275) * (1 if side == 0 else -1))
	# Keep the camera and body upright. Distant shot paths are compressed at the fold.
	var angle = 0.0
	var unit_tier = int(unit_id.right(1))
	var height_limit = (76.0 + unit_tier * 10) * (1.35 if unit_id.begins_with("spg") else 1.0)
	var scale_factor = minf(_battle_width(unit_tier) / meta.rect[2], height_limit / meta.rect[3])
	var offset = Vector2.ZERO
	if not last_hit.is_empty() and last_hit.side == side and last_hit.from == slot:
		var age = battle_clock - hit_time
		if age < 0.24:
			offset = -(muzzle - pivot).normalized() * sin(age / 0.24 * PI) * 5
	var launch = (muzzle - pivot).rotated(angle).normalized()
	return {"texture": key, "position": p + offset, "angle": angle, "scale": Vector2.ONE * scale_factor, "pivot": pivot, "launch": launch, "muzzle": p + offset + ((muzzle - pivot) * scale_factor).rotated(angle)}

func _shot_point(from: Vector2, target: Vector2, launch: Vector2, t: float, rocket: bool):
	var slope = 115.0 / 305.0
	var crossing = Vector2(1, -0.55).normalized() * (1 if from.y > _fold_y(from.x) else -1) if rocket else launch
	var rate = crossing.y - crossing.x * slope
	var entry = from + crossing * (-(from.y - _fold_y(from.x)) / rate)
	var exit_point = target - crossing * ((target.y - _fold_y(target.x)) / rate)
	if t < 0.44:
		var part = t / 0.44
		if rocket:
			# A visible straight launch segment follows even a steep howitzer barrel exactly.
			var lift = from + launch * maxf(30, from.distance_to(entry) * 0.15)
			if part < 0.10:
				return from.lerp(lift, part / 0.10)
			return lift.bezier_interpolate(lift + launch * maxf(45, from.distance_to(entry) * 0.3), from.lerp(entry, 0.67) - Vector2(0, 28), entry, (part - 0.10) / 0.90)
		return from.lerp(entry, part)
	if t < 0.56:
		return entry.lerp(exit_point, (t - 0.44) / 0.12)
	return exit_point.lerp(target, (t - 0.56) / 0.44)

func _fold_y(x):
	return 184.0 + x * (115.0 / 305.0)

func _ground_polygon(points: PackedVector2Array, side, shade = Color.WHITE, depth = 0.0):
	var uv = PackedVector2Array()
	var travel = -_ground_displacement(side, battle_clock) / Vector2(760, 507)
	for p in points:
		uv.append(p / Vector2(760, 507) + travel + Vector2(depth, -depth * 0.55))
	draw_colored_polygon(points, shade, uv, textures.battle_terrain)

func _battle_ground():
	var a = Vector2(0, _fold_y(0))
	var b = Vector2(1600, _fold_y(1600))
	_ground_polygon(PackedVector2Array([a, b, Vector2(1600, 900), Vector2(0, 900)]), 0, Color("b6b4a4"))
	_ground_polygon(PackedVector2Array([Vector2.ZERO, Vector2(1600, 0), b, a]), 1, Color("c5c3b4"))
	# Narrow oblique accordion: compress terrain into alternating lit/shaded facets.
	# Both armies share one projected ground plane, with opposing scrolling cameras.
	for segment in range(64):
		var x0 = segment * 25.0
		var x1 = x0 + 25
		for strip in range(3):
			var shade = [Color("9aaba2"), Color("5c7776"), Color("b8b99a")][strip]
			_ground_polygon(PackedVector2Array([Vector2(x0, _fold_edge(x0, strip)), Vector2(x1, _fold_edge(x1, strip)), Vector2(x1, _fold_edge(x1, strip + 1)), Vector2(x0, _fold_edge(x0, strip + 1))]), strip % 2, shade, strip * 0.13)
	if textures.has("battle_edges"):
		draw_texture_rect(textures.battle_edges, Rect2(0, 80, 1600, 760), false, Color(0.87, 0.91, 0.80))

func _fold_edge(x, edge):
	return _fold_y(x) - 9 + edge * 6 + sin(x * 0.041) * 2.4 + sin(x * 0.019 + edge * 1.6) * 1.5

func _effect(cell, r: Rect2, color = Color.WHITE):
	if textures.has("combat_fx"):
		var tex = textures.combat_fx
		var tile = tex.get_size() / 2
		draw_texture_rect_region(tex, r, Rect2(Vector2(cell % 2, int(cell / 2.0)) * tile, tile), color)

func _battle_position(side, slot):
	var column = (slot - 1) % 3
	var base = Vector2(385, 455) if side == 0 else Vector2(655, 305)
	var depth = Vector2(-205, 80) if side == 0 else Vector2(165, -115)
	return base + Vector2(305, 115) * column + (depth if slot > 3 else Vector2.ZERO)

func _battle_width(unit_tier):
	return [110.0, 130.0, 150.0, 171.0, 191.0, 211.0, 232.0][unit_tier - 1]

func _battle_done():
	for death in battle_deaths.values():
		if battle_clock - death.at < 1.65 - 0.000001:
			return false
	return battle_index >= report.get("events", []).size() and not pending_hit and (last_hit.is_empty() or battle_clock - hit_time >= 0.96 - 0.000001)

func _draw_battle_vehicle(st, side):
	var p = _unit_position(side, int(st.slot))
	var alive = st.totalHp > 0
	var tint = Color.WHITE if side == 0 else Color(1, 0.94, 0.90)
	var pose = _battle_pose(st.unitId, side, int(st.slot))
	if alive:
		if not _battle_done():
			var trail = Vector2(-55, 22) if side == 0 else Vector2(32, -27)
			_effect(2, Rect2(p + trail - Vector2(36, 22), Vector2(95, 53)), Color(0.86, 0.79, 0.61, 0.35))
		_draw_sprite_polygon(battle_sprite_meta[pose.texture], pose.position, pose.pivot, pose.scale.x, tint)
	else:
		_draw_wreck(st, side, p)
	var tag = p + Vector2(-92, -22)
	var count_label = str(int(st.count if alive else 0))
	var width = maxf(43, latin.get_string_size(count_label, HORIZONTAL_ALIGNMENT_LEFT, -1, 19).x + 22)
	draw_colored_polygon(PackedVector2Array([tag, tag + Vector2(width, 0), tag + Vector2(width - 5, 25), tag + Vector2(-5, 25)]), Color("193f32") if side == 0 else Color("532c26"))
	draw_line(tag, tag + Vector2(width, 0), Color("8fa58b") if side == 0 else Color("b08c75"), 1)
	_small(count_label, tag + Vector2(9, 20), 19, Color("e9edbe") if side == 0 else Color("ffd1a4"))
	var original_hp = 1.0
	for original in report.initial[side]:
		if original.slot == st.slot:
			original_hp = maxf(1, original.totalHp)
	_bar(Rect2(tag + Vector2(0, 26), Vector2(width - 4, 3)), st.totalHp / original_hp, GREEN if side == 0 else RED)
	_hit("battleUnit:%d:%d" % [side, st.slot], Rect2(p - Vector2(88, 64), Vector2(176, 118)))

func _destruction_frame(frame, r: Rect2, color = Color.WHITE):
	if textures.has("destruction_fx"):
		var tex = textures.destruction_fx
		var cell = tex.get_size() / 4.0
		draw_texture_rect_region(tex, r, Rect2(Vector2(frame % 4, int(frame / 4.0)) * cell, cell), color)

func _draw_wreck(st, side, p: Vector2):
	var key = "wreck_" + catalog.units[st.unitId].classId + ("_ne" if side == 0 else "_sw")
	if not battle_sprite_meta.has(key):
		return
	var meta = battle_sprite_meta[key]
	var unit_tier = int(st.unitId.right(1))
	var fit = minf(_battle_width(unit_tier) / meta.rect[2], (78.0 + unit_tier * 10.0) / meta.rect[3])
	var sz = Vector2(meta.rect[2], meta.rect[3]) * fit
	var origin = p + Vector2(-sz.x * 0.5, -sz.y + 32)
	_draw_sprite_polygon(meta, origin, Vector2.ZERO, fit, Color("b7a393"))
	# Small animated embers stay with the burnt chassis after the main blast.
	for i in range(5):
		var age = fmod(battle_clock * 0.6 + i * 0.19 + st.slot * 0.13, 1.0)
		var ember = p + Vector2(sin(i * 2.31) * 19 + age * 7, -10 - age * 39)
		draw_circle(ember, 1.6 * (1 - age), Color(1, 0.42, 0.09, (1 - age) * 0.8))

func _draw_destructions():
	for death in battle_deaths.values():
		var age = battle_clock - death.at
		if age < 0 or age >= 1.65:
			continue
		var p = _unit_position(death.side, death.slot) - Vector2(0, 6)
		var tier_size = int(death.unitId.right(1))
		var size_px = 152.0 + tier_size * 12
		var frame = mini(15, int(age / 1.65 * 16))
		var opacity = minf(1, (1.65 - age) / 0.28)
		_destruction_frame(frame, Rect2(p - Vector2(size_px * 0.5, size_px * 0.82), Vector2.ONE * size_px), Color(1, 1, 1, opacity))
		if age < 0.7:
			draw_arc(p, 15 + age * 100, 0, TAU, 36, Color(1, 0.75, 0.35, (0.7 - age) * 0.65), 2, true)
		for i in range(13):
			var direction = Vector2.from_angle(i * 2.39 + death.slot)
			var piece = p + direction * age * (49 + i * 4) + Vector2(0, -sin(minf(age, 1.2) / 1.2 * PI) * (22 + i % 4 * 13))
			var angle = age * 5 + i
			var verts = PackedVector2Array()
			for v in [Vector2(-4, -2), Vector2(5, -2), Vector2(2, 3)]:
				verts.append(piece + v.rotated(angle))
			draw_colored_polygon(verts, Color(0.31, 0.28, 0.23, opacity))
		if age < 1.1:
			var pos = p + Vector2(-25, -size_px * 0.6 - age * 16)
			draw_string_outline(bold, pos, "击毁", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, 4, Color("24100b"))
			_text("击毁", pos, 22, GOLD, true)

func _draw_volley():
	if last_hit.is_empty() or _battle_done():
		return
	var age = battle_clock - hit_time
	if age >= 1.03:
		return
	var source_unit = "tank_t1"
	for st in report.initial[int(last_hit.side)]:
		if st.slot == last_hit.from:
			source_unit = st.unitId
	var pose = _battle_pose(source_unit, int(last_hit.side), int(last_hit.from))
	var origin = pose.muzzle
	var rocket = source_unit.begins_with("rocket") or source_unit.begins_with("spg")
	if age < 0.22:
		draw_set_transform(origin, pose.launch.angle())
		_effect(0, Rect2(-2, -24, 68, 48), Color(1, 1, 1, 1 - age / 0.22))
		draw_set_transform(Vector2.ZERO)
	for e in battle_volley:
		var target = _unit_position(1 - int(e.side), int(e.to)) - Vector2(0, 20)
		if age < 0.32:
			# Piercing rounds follow a continuous beam; guided rockets fan out from their tubes.
			if age / 0.32 >= 0.44 and age / 0.32 <= 0.56:
				continue # Distance hidden inside the compressed camera seam.
			var head = _shot_point(origin, target, pose.launch, age / 0.32, rocket)
			var tail_t = maxf(0, (age - 0.045) / 0.32)
			if age / 0.32 > 0.56:
				tail_t = maxf(tail_t, 0.56)
			var tail = _shot_point(origin, target, pose.launch, tail_t, rocket)
			draw_line(tail, head, Color(0.99, 0.48, 0.10, 0.22), 12, true)
			draw_line(tail, head, Color("ffb331"), 3, true)
			draw_circle(head, 3.5, Color("fff4b1"))
		else:
			var burst = (age - 0.32) / 0.71
			if not e.miss:
				var extent = 130.0 + sin(minf(burst * 2, 1) * PI * 0.5) * 38
				_effect(1, Rect2(target - Vector2(extent * 0.5, extent * 0.62), Vector2.ONE * extent), Color(1, 1, 1, minf(1, (1 - burst) * 1.9)))
				for i in range(10):
					var direction = Vector2.from_angle(i * 2.39 + e.to)
					var point = target + direction * (15 + burst * 80)
					draw_line(point - direction * 8, point, Color(1, 0.72, 0.25, 1 - burst), 3, true)
			var label = "闪避" if e.miss else "−" + str(int(e.damage))
			var label_size = 22 if e.miss else 42 if e.critical else 34
			var w = bold.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size).x
			var text_pos = target + Vector2(-w * 0.5, -35 - burst * 35)
			text_pos.y = maxf(125, text_pos.y)
			var alpha = minf(1, (1 - burst) * 3)
			draw_string_outline(bold, text_pos + Vector2(2, 3), label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size, 6, Color(0.09, 0.06, 0.025, alpha))
			draw_string_outline(bold, text_pos, label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size, 2, Color(0.9, 0.18, 0.04, alpha))
			_text(label, text_pos, label_size, Color(1, 0.80, 0.22, alpha) if not e.miss else Color(0.85, 0.92, 0.83, alpha), true)
			if e.critical:
				_text("暴击", text_pos + Vector2(w + 6, -4), 14, GOLD, true)

func _battle_header():
	# Metal plates reference the compact original VS bar, adapted for a wide PC screen.
	draw_rect(Rect2(0, 0, 1600, 89), Color("111b1a"))
	for side in range(2):
		var points = PackedVector2Array([Vector2(18, 12), Vector2(711, 12), Vector2(674, 70), Vector2(18, 70)]) if side == 0 else PackedVector2Array([Vector2(889, 12), Vector2(1582, 12), Vector2(1582, 70), Vector2(926, 70)])
		draw_colored_polygon(points, Color("324238") if side == 0 else Color("493b31"))
		points.append(points[0])
		draw_polyline(points, Color("9c9f8b"), 2, true)
		var x = 44 if side == 0 else 967
		_text(s.get("nickname", "我方指挥官") if side == 0 else "敌方守军", Vector2(x, 42), 23, TEXT, true)
		_small("我方装甲编队" if side == 0 else report.get("title", "敌方阵地"), Vector2(x, 62), 13, GREEN if side == 0 else RED)
		_small("六格编队  /  自动交战", Vector2(472 if side == 0 else 1350, 47), 13, Color("bdc1ad"))
	draw_string_outline(latin, Vector2(753, 53), "VS", HORIZONTAL_ALIGNMENT_LEFT, -1, 48, 4, Color("060b0a"))
	_small("VS", Vector2(753, 53), 48, GOLD)
	_small("回合 %02d / %02d" % [last_hit.get("round", 1), report.get("rounds", 1)], Vector2(742, 78), 14, TEXT)
	draw_line(Vector2(0, 88), Vector2(1600, 88), GOLD.darkened(0.45), 2)

func _draw_battle():
	_battle_ground()
	# Painter ordering follows projected depth, so front vehicles cover rear scenery correctly.
	var units: Array = []
	for side in range(2):
		for st in battle_armies[side]:
			units.append({"stack": st, "side": side})
	units.sort_custom(func(a, b): return _unit_position(a.side, a.stack.slot).y < _unit_position(b.side, b.stack.slot).y)
	for item in units:
		_draw_battle_vehicle(item.stack, item.side)
	_draw_volley()
	_draw_destructions()
	_battle_header()
	if hover.begins_with("battleUnit:"):
		for item in units:
			var st = item.stack
			if hover == "battleUnit:%d:%d" % [item.side, st.slot]:
				_panel(Rect2(25, 108, 315, 64), Color(0.05, 0.10, 0.08, 0.92), GOLD.darkened(0.3))
				_text(catalog.units[st.unitId].name + "  ×%d" % st.count, Vector2(40, 134), 19, TEXT, true)
				_small("%s · 阵位 %d · 生命 %d" % ["我方" if item.side == 0 else "敌方", st.slot, st.totalHp], Vector2(40, 157), 14, MUTED)
	var done = _battle_done()
	_panel(Rect2(0, 839, 1600, 61), Color(0.035, 0.065, 0.058, 0.98), Color("64705a"))
	if done:
		_text(("演习胜利" if report.mode == "training" else "作战胜利") if report.winner == 0 else "行动受挫", Vector2(26, 879), 28, GOLD if report.winner == 0 else RED, true)
		if report.mode == "training":
			_text("演习不解锁关卡 · 无战损", Vector2(191, 877), 17, MUTED)
		else:
			_text("运输中" if report.mode == "world" else "缴获", Vector2(192, 875), 15, GOLD)
			_cost(report.rewards, Vector2(242, 869))
			if not report.get("coreRewards", {}).is_empty():
					_text("含核心奖励 · 详见战报", Vector2(780, 877), 13, GOLD)
		_button("battleDetails", "详细战报", Rect2(1010, 850, 150, 39))
		_button("battleReplay", "再次回放", Rect2(1172, 850, 150, 39))
		_button("nav:campaign", "返回世界" if report.mode == "world" else "返回战役", Rect2(1334, 850, 241, 39), "world" if report.mode == "world" else "campaign", true)
	else:
		_text("已暂停" if battle_paused else "交战中", Vector2(26, 876), 20, GOLD, true)
		var action_label = "装甲部队接敌 · 悬停战车查看详情"
		if not last_hit.is_empty():
			var verb = "齐射" if battle_volley.size() > 2 else "穿透射击" if battle_volley.size() == 2 else "开火"
			action_label = "%s %d 号阵位%s" % ["我方" if last_hit.side == 0 else "敌方", last_hit.from, verb]
		_text(action_label, Vector2(131, 876), 16, TEXT)
		_bar(Rect2(521, 866, 362, 4), float(battle_index) / maxi(1, report.events.size()), GOLD)
		_button("battlePause", "继续" if battle_paused else "暂停", Rect2(927, 850, 130, 39))
		_button("battleSpeed", "×%d 速度" % int(battle_speed), Rect2(1069, 850, 130, 39))
		_button("battleDetails", "战报", Rect2(1211, 850, 110, 39))
		_button("battleSkip", "跳过战斗", Rect2(1334, 850, 241, 39))
		# A bright field-green inset distinguishes the original's skip action.
		draw_rect(Rect2(1337, 853, 235, 33), Color(0.25, 0.53, 0.18, 0.22))

func _unit_guide():
	var u = catalog.units[_unit_id()]
	var effective = info.unitStats[u.unitId]
	var lines: Array[String] = [u.name, catalog.classDescriptions[u.classId], "",
		"基础攻击 %d → 科技与技能加成后 %d（实际伤害另受数量、克制、光环、命中与暴击影响）" % [u.attack, effective.attack],
		"基础生命 %d → 科技加成后 %d；每辆载重 %d" % [u.hp, effective.hp, u.load],
		"生产每辆：" + _cost_text(u.cost) + "，耗时 " + _time(u.productionSeconds * 1000 / (1 + s.tech.production * 0.05)),
		"维修每辆：" + _cost_text(u.repairCost) + "，耗时 " + _time(u.repairSeconds * 1000 / (1 + s.tech.production * 0.05)),
		"工厂 %d 级解锁。" % u.unlock.factoryLevel, "VI / VII 阶还需对应副本核心；可制造或消耗低一阶待命战车改装。", "", "【攻击模式】"]
	for c in CLASSES:
		lines.append(catalog.classNames[c] + "：" + catalog.classDescriptions[c])
	lines.append("横排：前排 1/2/3 中的存活阵位，前排清空后转后排；单体：最靠前的存活阵位；纵列：目标与同列后排；全体：全部存活阵位。")
	lines.append("经典攻击范围依据官网原有攻击模式说明。火箭齐射按每个目标结算，不再附加 35% 群攻折扣。")
	lines.append("同类光环不重复叠加，相关兵种阵位全部阵亡后光环消失。基础属性、光环数值和空位选敌顺序为本作单机设定。")
	lines.append("\n【当前兵种对各类目标的伤害倍率】")
	for m in catalog.rules.matchup:
		if m.attackerClass == u.classId:
			lines.append("对 " + catalog.classNames[m.defenderClass] + "：%.2f 倍" % (m.multiplierBps / 10000.0))
	lines.append("\n【六格与战损】\n前排 1 / 2 / 3，后排 4 / 5 / 6，同列为 1—4、2—5、3—6。\n每格受统率上限约束，同型跨格共用库存；出征中的部队不可重复部署。\n正式战斗损失按同型号汇总，70% 向下取整进入待修，其余永久损失。\n演习不改变兵力、不发奖励；正式战役可重复挑战，首通奖励只发一次。")
	_details("兵种图鉴 / " + u.name, "\n".join(lines))

func _report_details():
	var lines: Array[String] = [report.title, "规则：" + report.ruleset + "   随机种子：" + str(int(report.seed)),
		"结算结果：" + ("胜利" if report.winner == 0 else "失利") + "；回放不会再次结算奖励。", ""]
	if report.mode == "training":
		lines.append("本场为演习：生还与损失只表示推演结果，实际库存不变，不发奖励。\n")
	for side in range(2):
		lines.append("【我方出战】" if side == 0 else "【敌方出战】")
		for st in report.initial[side]:
			lines.append("阵位 %d  %s × %d  单车生命 %d  基础攻击 %d" % [st.slot, catalog.units[st.unitId].name, st.count, st.hp, st.attack])
	lines.append("\n【我方结算】")
	for c in report.casualties:
		lines.append("%s：出战 %d / 生还 %d / 待修 %d / 永久损失 %d" % [catalog.units[c.unitId].name, c.sent, c.survived, c.repairable, c.destroyed])
	lines.append(("待回城入库：" if report.mode == "world" else "物资奖励：") + _cost_text(report.rewards))
	for core_id in report.get("coreRewards", {}):
		lines.append("核心缴获：" + catalog.coreNames[core_id] + " ×%d" % report.coreRewards[core_id])
	var growth = report.get("growth", {})
	if not growth.is_empty():
		lines.append("经验 +%d / 声望 +%d / 统率书 +%d / 技能点 +%d" % [growth.xp, growth.prestige, growth.books, growth.skillPoints])
	lines.append("\n【逐次伤害日志】")
	for e in report.events:
		lines.append("回合 %02d · %s阵位 %d → 阵位 %d：%s %d 伤害，目标剩余 %d 辆 / %d 生命" % [e.round, "我方" if e.side == 0 else "敌方", e.from, e.to, "未命中" if e.miss else "暴击" if e.critical else "命中", e.damage, e.remaining, e.hp])
	_details("详细战报", "\n".join(lines))

func _smoke_test():
	for i in range(160):
		await get_tree().create_timer(0.1).timeout
		if not s.is_empty() or fatal != "":
			break
	if s.is_empty():
		print("NATIVE_SMOKE_FAILED: boot: " + fatal)
		get_tree().quit(2)
		return
	var out = ProjectSettings.globalize_path("res://../artifacts/native")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--qa-output="):
			out = arg.trim_prefix("--qa-output=")
	DirAccess.make_dir_recursive_absolute(out)
	for tab in ["base", "factory", "army", "research", "campaign", "world", "commander", "reports", "settings", "vip", "queues"]:
		_navigate(tab)
		await get_tree().create_timer(0.25).timeout
		await get_tree().create_timer(0.07).timeout
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(out.path_join(tab + ".png"))
	_action("nav:factory", "factory")
	quantity = 5
	_action("produce")
	await _settled()
	if not s.jobs.has("production"):
		print("NATIVE_SMOKE_FAILED: production")
		get_tree().quit(3)
		return
	_action("accelerate:production", "production")
	_confirm_action()
	await _settled()
	if s.available.tank_t1 != 25:
		print("NATIVE_SMOKE_FAILED: accelerate")
		get_tree().quit(4)
		return
	_action("formationAuto")
	await _settled()
	selected_stage = 2
	_action("training")
	await _settled()
	if report.is_empty() or screen != "battle":
		print("NATIVE_SMOKE_FAILED: battle")
		get_tree().quit(5)
		return
	measure_frames = true
	await get_tree().create_timer(3.0).timeout
	measure_frames = false
	frame_times.sort()
	var elapsed = 0.0
	for ms in frame_times:
		elapsed += ms
	open_report(report)
	await get_tree().create_timer(0.78).timeout
	battle_paused = true
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle.png"))
	_action("battleSkip")
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle-result.png"))
	_action("battleDetails")
	await get_tree().create_timer(0.1).timeout
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	details_dialog.get_texture().get_image().save_png(out.path_join("report-details.png"))
	if not details_text.text.contains("逐次伤害日志") or not details_text.text.contains(report.ruleset):
		print("NATIVE_SMOKE_FAILED: report details")
		get_tree().quit(6)
		return
	details_dialog.hide()
	_navigate("factory")
	_action("unitGuide")
	await get_tree().create_timer(0.1).timeout
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	details_dialog.get_texture().get_image().save_png(out.path_join("unit-guide.png"))
	if not details_text.text.contains("伤害倍率"):
		get_tree().quit(7)
		return
	details_dialog.hide()
	_navigate("world")
	_action("mapSearch")
	name_input.text = "17,16"
	_text_confirmed()
	text_dialog.hide()
	if selected_site != "site-0" or map_zoom < 2:
		print("NATIVE_SMOKE_FAILED: map coordinates")
		get_tree().quit(8)
		return
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("world-located.png"))
	_navigate("base")
	_action("rest:60", 60)
	if not confirm_dialog.visible:
		print("NATIVE_SMOKE_FAILED: confirmation")
		get_tree().quit(9)
		return
	confirm_dialog.hide()
	await _settled()
	if s.get("timeOffset", 0) != 0:
		print("NATIVE_SMOKE_FAILED: cancelled rest mutated save")
		get_tree().quit(10)
		return
	_action("rest:60", 60)
	_confirm_action()
	await _settled()
	if s.get("timeOffset", 0) != 3600000:
		print("NATIVE_SMOKE_FAILED: rest clock")
		get_tree().quit(11)
		return
	var old_id = s.id
	dialog_mode = "export"
	_file_selected(out.path_join("native-ui-roundtrip.json"))
	await _settled()
	dialog_mode = "import"
	_file_selected(out.path_join("native-ui-roundtrip.json"))
	await _settled()
	if s.id == old_id or s.get("timeOffset", 0) != 3600000 or s.available.tank_t1 != 25:
		print("NATIVE_SMOKE_FAILED: import callback roundtrip")
		get_tree().quit(12)
		return
	var imported_id = s.id
	draft = [{"unitId": "tank_t1", "count": 5}, null, null, null, null, null]
	dirty = true
	var save_key = InputEventKey.new()
	save_key.keycode = KEY_F5
	save_key.pressed = true
	_unhandled_key_input(save_key)
	await _settled()
	if dirty or s.formation[0].count != 5:
		print("NATIVE_SMOKE_FAILED: F5 formation save")
		get_tree().quit(13)
		return
	_action("copy")
	name_input.text = "决战前存档副本"
	_text_confirmed()
	text_dialog.hide()
	await _settled()
	var copied_id = s.id
	if copied_id == imported_id or s.nickname != "决战前存档副本":
		print("NATIVE_SMOKE_FAILED: save copy")
		get_tree().quit(14)
		return
	draft[0].count = 4
	dirty = true
	_action("load:" + imported_id, imported_id)
	if not confirm_dialog.visible:
		print("NATIVE_SMOKE_FAILED: unsaved edits confirmation")
		get_tree().quit(15)
		return
	_cancel_action()
	confirm_dialog.hide()
	await _settled()
	if s.id != copied_id or not dirty or draft[0].count != 4:
		get_tree().quit(16)
		return
	_action("save")
	await _settled()
	_action("load:" + imported_id, imported_id)
	await _settled()
	if s.id != imported_id or s.formation[0].count != 5:
		print("NATIVE_SMOKE_FAILED: independent save switch")
		get_tree().quit(17)
		return
	_action("load:" + copied_id, copied_id)
	await _settled()
	if s.id != copied_id or s.formation[0].count != 4:
		get_tree().quit(18)
		return
	# Re-export to an existing destination to exercise atomic file replacement.
	dialog_mode = "export"
	_file_selected(out.path_join("native-ui-roundtrip.json"))
	await _settled()
	var replacement = JSON.parse_string(FileAccess.get_file_as_string(out.path_join("native-ui-roundtrip.json")))
	if replacement == null or replacement.state.formation[0].count != 4:
		print("NATIVE_SMOKE_FAILED: overwrite export")
		get_tree().quit(19)
		return
	# Rejected imports preserve both the current slot and an unsaved formation.
	var invalid_path = out.path_join("invalid-qa.json")
	FileAccess.open(invalid_path, FileAccess.WRITE).store_string("{invalid")
	draft[0].count = 3
	dirty = true
	dialog_mode = "import"
	_file_selected(invalid_path)
	_confirm_action()
	await _settled()
	if s.id != copied_id or not dirty or draft[0].count != 3:
		print("NATIVE_SMOKE_FAILED: rejected import discarded draft")
		get_tree().quit(20)
		return
	_action("save")
	await _settled()
	_action("new")
	name_input.text = "全新独立基地"
	_text_confirmed()
	text_dialog.hide()
	await _settled()
	if s.id == copied_id or s.available.tank_t1 != 20:
		print("NATIVE_SMOKE_FAILED: new save")
		get_tree().quit(21)
		return
	_action("load:" + copied_id, copied_id)
	await _settled()
	_navigate("settings")
	await _settled()
	toast_until = 0
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("save-manager.png"))
	# Expand the native acceptance run with a legitimately earned offline progression save.
	var advanced_save = out.path_join("arsenal-journey-save.json")
	if not FileAccess.file_exists(advanced_save):
		print("NATIVE_SMOKE_FAILED: missing arsenal journey fixture")
		get_tree().quit(22)
		return
	dialog_mode = "import"
	_file_selected(advanced_save)
	await _settled()
	if s.buildings.factory != 20 or s.arsenal.cleared.size() != 8:
		print("NATIVE_SMOKE_FAILED: advanced import")
		get_tree().quit(23)
		return
	_navigate("factory")
	tier = 7
	quantity_input.text = "27"
	quantity_input.text_changed.emit("27")
	if quantity != 27:
		get_tree().quit(24)
		return
	_action("quantityMax")
	if quantity != info.unitStats.tank_t7.produce.max or quantity_input.text != str(quantity):
		get_tree().quit(25)
		return
	toast_until = 0
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("factory-tier7.png"))
	_action("productionMode:refit", "refit")
	_action("quantityMax")
	if quantity != info.unitStats.tank_t7.refit.max:
		get_tree().quit(26)
		return
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("factory-refit.png"))
	var old_units = s.available.tank_t7
	_set_quantity(1)
	_action("produce")
	await _settled()
	if not s.jobs.has("production") or s.jobs.production.get("sourceUnitId", "") != "tank_t6":
		print("NATIVE_SMOKE_FAILED: refit start")
		get_tree().quit(27)
		return
	_action("accelerate:production", "production")
	_confirm_action()
	await _settled()
	if s.available.tank_t7 != old_units + 1:
		get_tree().quit(28)
		return
	production_mode = "produce"
	screen = "qa_atlas"
	await get_tree().create_timer(0.1).timeout
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("unit-atlas.png"))
	_action("coreDungeons")
	selected_dungeon = 1
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("core-dungeons.png"))
	# All 28 sprite barrels, both sides, every row: muzzle ray must meet its target.
	for u in catalog.unitList:
		for side in range(2):
			for slot in range(1, 7):
				for target_slot in range(1, 7):
					var target = _battle_position(1 - side, target_slot) - Vector2(0, 20)
					battle_aims["%d:%d" % [side, slot]] = target
					var pose = _battle_pose(u.unitId, side, slot)
					var muzzle_ray = (pose.muzzle - pose.position).normalized()
					var first_step = _shot_point(pose.muzzle, target, pose.launch, 0.001, u.classId == "rocket" or u.classId == "spg") - pose.muzzle
					if muzzle_ray.dot(first_step.normalized()) < 0.99998:
						print("NATIVE_SMOKE_FAILED: barrel alignment " + u.unitId)
						get_tree().quit(29)
						return
	_action("dungeonTraining")
	await _settled()
	open_report(report)
	await get_tree().create_timer(0.8).timeout
	battle_paused = true
	toast_until = 0
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	var paused_frame = get_viewport().get_texture().get_image()
	paused_frame.save_png(out.path_join("battle-advanced.png"))
	await get_tree().create_timer(0.3).timeout
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	if paused_frame.get_data() != get_viewport().get_texture().get_image().get_data():
		print("NATIVE_SMOKE_FAILED: pause did not freeze battle")
		get_tree().quit(30)
		return
	battle_paused = false
	await get_tree().create_timer(0.35).timeout
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle-advanced-moving.png"))
	var stats = {"engine": Engine.get_version_info().string, "screens": 13, "production": "pass", "acceleration": "pass", "formation": "pass", "training": "pass", "details": "pass", "unit_guide": "pass", "coordinate_search": "pass", "rest_cancel_and_commit": "pass", "file_callback_roundtrip": "pass", "f5_formation_save": "pass", "save_as_copy": "pass", "switch_and_cancel": "pass", "atomic_export_replace": "pass", "invalid_import_keeps_draft": "pass", "new_slot": "pass", "render_fps": frame_times.size() * 1000 / elapsed, "frames_measured": frame_times.size(), "p95_frame_ms": frame_times[int(frame_times.size() * 0.95)], "renderer": RenderingServer.get_video_adapter_name()}
	FileAccess.open(out.path_join("smoke.json"), FileAccess.WRITE).store_string(JSON.stringify(stats, "  "))
	stats["seven_tiers"] = "pass"
	stats["manual_quantity_and_max"] = "pass"
	stats["core_refit"] = "pass"
	stats["barrel_alignment_cases"] = 2016
	stats["pause_freezes_scene"] = "pass"
	if not await _battle_scene_qa(out):
		print("NATIVE_SMOKE_FAILED: diagonal battle scene")
		get_tree().quit(31)
		return
	stats["diagonal_battle_and_six_target_salvo"] = "pass"
	if not await _v06_qa(out):
		print("NATIVE_SMOKE_FAILED: v06 campaign / VIP / destruction")
		get_tree().quit(43)
		return
	stats["v06_campaign_unlock_vip_queues_destruction"] = "pass"
	if not await _v07_qa(out):
		print("NATIVE_SMOKE_FAILED: v07 wreck / audio / silhouettes")
		get_tree().quit(44)
		return
	stats["v07_world_fixed_wrecks_class_audio_silhouettes"] = "pass"
	FileAccess.open(out.path_join("smoke.json"), FileAccess.WRITE).store_string(JSON.stringify(stats, "  "))
	print("NATIVE_SMOKE_PASS: " + JSON.stringify(stats))
	get_tree().quit()

func _battle_preview():
	for i in range(160):
		await get_tree().create_timer(0.1).timeout
		if not s.is_empty() or fatal != "":
			break
	var out = ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--qa-output="):
			out = arg.trim_prefix("--qa-output=")
	if s.is_empty() or out == "":
		get_tree().quit(41)
		return
	var passed = await _v07_qa(out) if "--v07-preview" in OS.get_cmdline_user_args() else await _v06_qa(out) if "--v06-preview" in OS.get_cmdline_user_args() else await _battle_scene_qa(out)
	print("BATTLE_SCENE_QA: ", passed)
	get_tree().quit(0 if passed else 42)

func _battle_scene_qa(out):
	var fixture = JSON.parse_string(FileAccess.get_file_as_string(out.path_join("battle-report-v05.json")))
	if not fixture is Dictionary:
		return false
	open_report(fixture)
	battle_paused = true
	battle_speed = 1
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle-isometric.png"))
	_battle_step(1.17)
	if battle_volley.size() != 6 or not pending_hit or battle_armies[1][0].totalHp != fixture.initial[1][0].totalHp:
		print("BATTLE_SCENE_FAILED: salvo grouping or early damage")
		return false
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle-projectile.png"))
	_battle_step(0.34)
	for e in battle_volley:
		if battle_armies[1][int(e.to) - 1].totalHp != e.hp:
			return false
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	var frozen = get_viewport().get_texture().get_image()
	frozen.save_png(out.path_join("battle-salvo.png"))
	await get_tree().create_timer(0.15).timeout
	await RenderingServer.frame_post_draw
	if frozen.get_data() != get_viewport().get_texture().get_image().get_data():
		return false
	for speed in [1, 2, 4]:
		open_report(fixture)
		battle_paused = true
		battle_speed = speed
		_battle_step(100)
		if not _battle_done():
			return false
		for side in range(2):
			for i in range(battle_armies[side].size()):
				if battle_armies[side][i].totalHp != fixture.final[side][i].totalHp:
					print("BATTLE_SCENE_FAILED: final armies at speed ", speed)
					return false
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle-natural-result.png"))
	open_report(fixture)
	battle_paused = true
	_action("battleSkip")
	if not battle_volley.is_empty() or not _battle_done():
		return false
	for team in battle_armies:
		for st in team:
			if st.count != ceili(float(st.totalHp) / st.hp):
				return false
	await get_tree().create_timer(0.07).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle-result.png"))
	open_report(fixture)
	battle_paused = true
	var original_size = get_window().size
	get_window().size = Vector2i(1120, 630)
	await get_tree().create_timer(0.15).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join("battle-1120x630.png"))
	get_window().size = original_size
	battle_speed = 1
	battle_paused = false
	frame_times.clear()
	measure_frames = true
	await get_tree().create_timer(3.0).timeout
	measure_frames = false
	var duration = 0.0
	for ms in frame_times:
		duration += ms
	frame_times.sort()
	FileAccess.open(out.path_join("battle-scene.json"), FileAccess.WRITE).store_string(JSON.stringify({"salvo_targets":6,"damage_after_impact":"pass","pause_pixels":"pass","speed_1_2_4_final_hp":"pass","skip_final_counts":"pass","reference_layout":"diagonal folded isometric","battle_views":56,"render_fps":frame_times.size() * 1000.0 / duration,"p95_frame_ms":frame_times[int(frame_times.size() * 0.95)],"minimum_window":"1120x630"}, "  "))
	return true


func _v07_qa(out):
	var fixtures = JSON.parse_string(FileAccess.get_file_as_string(out.path_join("v07-fixtures.json")))
	if not fixtures is Dictionary:
		return false
	var original_mute = muted
	muted = false
	if battle_audio.size() != 8:
		return false
	for key in battle_audio:
		if not battle_audio[key] is AudioStreamWAV or battle_audio[key].get_length() < 0.5:
			return false
	for i in range(4):
		open_report(fixtures.audio[i])
		battle_speed = 1
		battle_paused = true
		_battle_step(1.17)
		if battle_audio_events.size() != 1 or battle_audio_events[0].key != CLASSES[i] + "_fire":
			print("V07_FAILED: fire timing / class ", i)
			return false
		_battle_step(0.30)
		if battle_audio_events.size() != 2 or battle_audio_events[1].key != CLASSES[i] + "_impact":
			print("V07_FAILED: impact timing / class ", i)
			return false
		_sync_battle_audio()
		if battle_voices.any(func(v): return v.playing and not v.stream_paused):
			return false
		battle_paused = false
		_sync_battle_audio()
		if not battle_voices.any(func(v): return v.playing and not v.stream_paused):
			return false
		battle_paused = true
		muted = true
		_sync_battle_audio()
		if battle_voices.any(func(v): return v.playing):
			return false
		muted = false
		_action("battleSkip")
		if battle_voices.any(func(v): return v.playing) or not battle_audio_events.is_empty():
			return false
	# Misses must not play armor-hit audio.
	open_report(fixtures.audio[1])
	battle_paused = true
	_battle_step(1.17)
	for e in battle_volley:
		e.miss = true
	_battle_step(0.3)
	if battle_audio_events.size() != 1:
		return false
	for i in range(2):
		var fixture = fixtures.deaths[i]
		open_report(fixture)
		battle_paused = true
		battle_speed = 1
		while battle_deaths.is_empty() and battle_clock < 10:
			_battle_step(0.025)
		if battle_deaths.is_empty():
			return false
		var death = battle_deaths.values()[0]
		var start = _unit_position(death.side, death.slot)
		var elapsed = battle_clock
		var uv = start / Vector2(760, 507) - _ground_displacement(death.side, battle_clock) / Vector2(760, 507)
		_battle_step(0.95)
		var moved = _unit_position(death.side, death.slot)
		var actual_uv = moved / Vector2(760, 507) - _ground_displacement(death.side, battle_clock) / Vector2(760, 507)
		if uv.distance_to(actual_uv) > 0.00001 or moved.distance_to(start) < 20:
			print("V07_FAILED: wreck does not follow ground UV ", i)
			return false
		if (moved - start).distance_to(_ground_displacement(death.side, battle_clock - elapsed)) > 0.01:
			return false
		await _qa_capture(out, "v07-wreck-side-%d" % death.side)
		_battle_step(100)
		var natural = _unit_position(death.side, death.slot)
		var natural_time = battle_clock
		for speed in [1, 2, 4]:
			open_report(fixture)
			battle_speed = speed
			battle_paused = true
			_battle_step(100)
			if absf(battle_clock - natural_time) > 0.001 or _unit_position(death.side, death.slot).distance_to(natural) > 0.1:
				print("V07_FAILED: speed changes wreck position")
				return false
		_action("battleSkip")
		if not _battle_done() or _unit_position(death.side, death.slot).distance_to(natural) > 0.1:
			print("V07_FAILED: skip differs from natural completion")
			return false
		open_report(fixture)
		battle_paused = true
		if not battle_deaths.is_empty():
			return false
	muted = original_mute
	_stop_battle_audio()
	screen = "qa_atlas"
	await _qa_capture(out, "v07-seven-tier-class-silhouettes")
	open_report(JSON.parse_string(FileAccess.get_file_as_string(out.path_join("battle-report-v05.json"))))
	battle_paused = true
	battle_speed = 1
	await _qa_capture(out, "v07-battle-classes")
	FileAccess.open(out.path_join("v07-regression.json"), FileAccess.WRITE).store_string(JSON.stringify({"audio_assets":8,"class_fire_impact_timing":"pass","miss_without_impact":"pass","audio_pause_resume_mute_skip":"pass","wreck_ground_uv_lock_both_sides":"pass","wreck_speed_1_2_4_skip_replay":"pass","new_class_views":28,"battle_rules":"classic-combat-v0.7"}, "  "))
	return true

func _qa_capture(out, name):
	toast_until = 0
	await get_tree().create_timer(0.09).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join(name + ".png"))

func _v06_qa(out):
	campaign_mode = "stage"
	selected_class = 0
	tier = 1
	production_mode = "produce"
	request({"op": "new", "nickname": "版本验收", "seed": 2601001})
	await _settled()
	selected_stage = 0
	_action("attack")
	await _settled()
	if report.winner != 0 or not info.stageStatus[0].cleared or not info.stageStatus[1].unlocked:
		print("V06_FAILED: stage one progression")
		return false
	# Seek the actual last-enemy destruction and compare animated frames at fixed ages.
	open_report(report)
	battle_paused = true
	battle_speed = 1
	for i in range(5000):
		_battle_step(0.02)
		if not battle_deaths.is_empty():
			break
	if battle_deaths.is_empty():
		print("V06_FAILED: no destruction event")
		return false
	_battle_step(0.10)
	await _qa_capture(out, "destruction-flash")
	var flash = get_viewport().get_texture().get_image().get_data()
	_battle_step(0.55)
	await _qa_capture(out, "destruction-fireball")
	if flash == get_viewport().get_texture().get_image().get_data():
		return false
	var frozen = get_viewport().get_texture().get_image().get_data()
	await _qa_capture(out, "destruction-paused")
	if frozen != get_viewport().get_texture().get_image().get_data():
		return false
	_battle_step(100)
	await _qa_capture(out, "destruction-wreck")
	if not _battle_done():
		return false
	_navigate("campaign")
	selected_stage = 1
	await _qa_capture(out, "campaign-second-unlocked")
	var enabled = false
	for b in buttons:
		if b.id == "attack":
			enabled = b.enabled
	if not enabled:
		print("V06_FAILED: stage two button disabled after JSON round trip")
		return false
	request({"op": "load", "id": s.id})
	await _settled()
	_action("attack")
	await _settled()
	if report.title != catalog.stageNames[1]:
		return false
	_action("battleSkip")
	_navigate("vip")
	_action("rootLogin")
	if not name_input.secret:
		return false
	name_input.text = "TankStorm2026!"
	_text_confirmed()
	text_dialog.hide()
	await _settled()
	if not info.rootUnlocked:
		return false
	_action("rootRecharge")
	name_input.text = "7200"
	_text_confirmed()
	text_dialog.hide()
	await _settled()
	if info.vip.level != 5:
		return false
	await _qa_capture(out, "vip-five-root")
	command({"type": "upgrade", "building": "hq"})
	await _settled()
	_action("accelerate:building", "building")
	_confirm_action()
	await _settled()
	for b in ["iron", "oil", "factory", "lab"]:
		command({"type": "upgrade", "building": b})
	await _settled()
	for tech in ["attack", "hp", "production", "gather"]:
		command({"type": "research", "tech": tech})
	for i in range(4):
		command({"type": "produce", "unitId": "tank_t1", "count": 2})
	await _settled()
	if info.queues.building.active != 4 or info.queues.production.waiting != 3 or info.queues.research.waiting != 3:
		print("V06_FAILED: queue capacity ", info.queues)
		return false
	_navigate("queues")
	await _qa_capture(out, "vip-queues-active")
	queue_page = 1
	await _qa_capture(out, "vip-queues-waiting")
	_navigate("world")
	await _qa_capture(out, "world-full-estimate")
	_navigate("factory")
	_set_quantity(20)
	await _qa_capture(out, "production-wait-estimate")
	_navigate("research")
	await _qa_capture(out, "research-wait-estimate")
	_navigate("base")
	selected_building = "lab"
	await _qa_capture(out, "building-time-estimate")
	FileAccess.open(out.path_join("v06-acceptance.json"), FileAccess.WRITE).store_string(JSON.stringify({"campaign_first_win_second_button_and_attack": "pass", "password_masking_and_root_recharge": "pass", "vip_building_parallel": 4, "production_and_research_waiting_each": 3, "destruction_animation_and_pause_pixels": "pass", "asset_identities": 28, "directional_views": 56, "wreck_views": 8, "destruction_frames": 16}, "  "))
	return true

func _settled():
	for i in range(200):
		await get_tree().create_timer(0.05).timeout
		if not waiting and requests.is_empty():
			return
