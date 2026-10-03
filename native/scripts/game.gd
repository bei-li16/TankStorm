extends Control

const QuantityFormat = preload("res://scripts/quantity_format.gd")

const GOLD = Color("d7b776")
const TEXT = Color("ebe7dc")
const MUTED = Color("949e96")
const GREEN = Color("8fba86")
const RED = Color("de8771")
const PANEL = Color("131c1d")
const LINE = Color("394544")
const RES = ["iron", "oil", "lead", "titanium", "crystal", "gold"]
const CLASSES = ["tank", "tank_destroyer", "spg", "rocket"]
# Match the six ignitions already recorded in rocket_fire.wav; one clip per action.
const ROCKET_LAUNCH_OFFSETS = [0.0, 0.075, 0.16, 0.245, 0.33, 0.42]
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
var inventory_category = "all"
var inventory_class = "all"
var inventory_owned = false
var inventory_page = 0
var settlement_visible = true
var settlement_reward_page = 0
var research_branch = "economy"
var selected_tech = "resourceOutput"
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
var selected_factory = "factory"
var repair_unit = "tank_t1"
var repair_page = 0
var repair_history = false
var reserve_page = 0
var campaign_mode = "stage"
var selected_dungeon = 0
var attribute_scope = "unit"
var battle_clock = 0.0
var battle_aims: Dictionary = {}
var battle_volley: Array = []
var battle_shots: Array = []
var battle_pending_impacts: Array = []
var battle_impact_played = false
var battle_visual_end = 0.0
var battle_craters: Array = []
var battle_interval = 1.05
var battle_sprite_meta: Dictionary = {}
var pending_hit = false
var sprite_meta: Dictionary = {}
var selected_slot = 0
var draft: Array = []
var deployment: Dictionary = {}
var deployment_backup: Dictionary = {}
var deployment_retry: Dictionary = {}
var deployment_pending = false
var deployment_enemy = false
var dirty = false
var drag_slot = -1
var selected_stage = 0
var leadership_attempts = 1
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
var dispatch_selected = "building"
var base_panel = "dispatch"
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
var ui_scale = 1.0
var audio_volume = 0.75
var settings_advanced = false
var focus_id = ""
var details_key = ""
var details_scroll = {}
var library_category = "all"
var library_query = ""
var library_selected = "initiative"
var library_page = 0
var library_scroll = {}
var library_rendered = ""
var library_scale = 0.0
var library_search: LineEdit
var library_reader: RichTextLabel
var library_origin = "base"
var library_battle_paused = false
var completion_marks = {}
var progress_report = {}
var reserve_class = "all"
var reserve_tier = 0
var reserve_filter = "owned"
var reserve_sort = false
var compare_unit = ""
var map_resource = "all"
var map_level = 0
var map_intel = "all"
var battle_labels: Array[Rect2] = []
var manufacture_quantity = 10
var repair_limit = -1
var report_rows: Array = []
var report_type = "all"
var report_result = "all"
var rest_preview = {}
var preset_index = 0
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
	_apply_field_theme()
	for name in ["base", "tank", "tank_destroyer", "spg", "rocket", "resources", "battlefield", "worldmap", "emblem", "tank-tiers", "tank_destroyer-tiers", "spg-tiers", "rocket-tiers", "march_ground", "combat_fx", "battle_tank", "battle_tank_destroyer", "battle_spg", "battle_rocket", "battle_terrain", "battle_edges", "destruction_fx", "battle_wrecks", "tank_core7", "tank_destroyer_core7", "spg_core7", "rocket_core7", "tank_core6", "tank_destroyer_core6", "spg_core6", "rocket_core6", "ground_industrial", "ground_oilfield", "ground_fortress", "ground_proving", "tank_core7_field", "tank_destroyer_core7_field", "spg_core7_field", "rocket_core7_field"]:
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
	_setup_library()
	var prefs = ConfigFile.new()
	if prefs.load("user://preferences.cfg") == OK:
		muted = prefs.get_value("audio", "muted", false)
		audio_volume = clampf(prefs.get_value("audio", "volume", 0.75), 0, 1)
		ui_scale = clampf(prefs.get_value("display", "text_scale", 1.0), 1, 1.2)
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.001, audio_volume)))
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
	for dialog in [details_dialog, text_dialog, confirm_dialog]:
		dialog.theme = theme
		dialog.get_ok_button().custom_minimum_size = Vector2(140, 42)
	details_dialog.visibility_changed.connect(func():
		if not details_dialog.visible and details_key != "": details_scroll[details_key] = details_text.scroll_vertical)

func _confirm(command_data: Dictionary, message: String):
	pending_request = {}
	pending_action = command_data
	confirm_dialog.dialog_text = message
	confirm_dialog.reset_size()
	confirm_dialog.popup_centered(Vector2i(550,210))

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
	if details_dialog.visible and details_key != "":
		details_scroll[details_key] = details_text.scroll_vertical
	details_key = title + ":" + str(value.hash())
	details_dialog.title = title
	details_text.text = value
	details_text.set_caret_line(0)
	details_text.set_caret_column(0)
	details_text.scroll_horizontal = 0
	details_text.scroll_vertical = details_scroll.get(details_key, 0)
	details_dialog.popup_centered()
	details_text.set_deferred("scroll_vertical", details_scroll.get(details_key, 0))

func _cost_text(cost, multiplier = 1):
	var parts: Array[String] = []
	for r in RES:
		if cost.get(r, 0) > 0:
			parts.append(catalog.resourceNames[r] + " " + _amount(cost[r] * multiplier))
	return "、".join(parts)

func _process(delta):
	_sync_battle_audio()
	clock += delta
	quantity_input.visible = screen in ["factory", "repair"] and not s.is_empty() and not _modal_open()
	_library_sync()
	quantity_input.position = Vector2(748, 465) if screen == "factory" else Vector2(1121, 445)
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
	var deployment_reply = not deployment_retry.is_empty() and current_request.get("id", "") == deployment_retry.id
	if deployment_reply:
		deployment_pending = false
	waiting = false
	var data = JSON.parse_string(body.get_string_from_utf8())
	if result != HTTPRequest.RESULT_SUCCESS or not data is Dictionary:
		toast_message("连接中断，已提交的操作会保留在本地存档中")
	elif not data.get("ok", false):
		toast_message(data.get("error", "操作未完成"))
		if s.is_empty():
			fatal = data.get("error", "存档加载失败")
	else:
		_notify_progress(s, data.state)
		s = data.state
		info = data.info
		if data.has("coreBudget"): _show_core_budget(data.coreBudget)
		if screen == "repair": _validate_repair_quantity(false)
		if data.has("restPreview"):
			rest_preview = data.restPreview
			_confirm({"type":"rest","minutes":rest_preview.minutes},_rest_preview_text())
		if not report.is_empty() and report.mode == "world":
			for archived in s.reports:
				if archived.id == report.id: report.transport = archived.get("transport", {})
		if data.has("progress"):
			progress_report = data.progress
			screen = "restReport"
		if deployment_reply:
			deployment = {}
			deployment_backup = {}
			deployment_retry = {}
			dirty = false
			draft = info.usable.duplicate(true)
			if current_request.get("command",{}).get("type") == "march": screen = "world"
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
			base_panel = "dispatch"
			dispatch_selected = "building"
			queue_page = 0
			report_rows = s.reports.duplicate(true)
			rest_preview = {}
			progress_report = {}
			deployment = {}
			deployment_backup = {}
			deployment_retry = {}
			deployment_pending = false
			if screen == "deployment":
				screen = "campaign"
			selected_site = s.world[0].id
			save_page = 0
			report_page = 0
			map_center = Vector2(s.home.x, s.home.y)
		if not data.get("message", "").is_empty() and not data.has("report"):
			toast_message(data.message)
		if not data.get("recovered", "").is_empty():
			toast_message(data.recovered)
		if data.has("report"):
			open_report(data.report, data.get("settlement", {}))
			if current_request.get("summaryOnly", false):
				_seek_battle_end()
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
	if deployment_pending:
		return
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
				elif b.rect.has_point(event.position) and not b.enabled:
					_disabled_help(b.id, b.data)
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
	if event.keycode == KEY_F1 and not s.is_empty():
		_navigate("library")
		return
	if screen == "library" and event.ctrl_pressed and event.keycode == KEY_F:
		library_search.grab_focus()
		library_search.select_all()
		return
	if event.keycode == KEY_TAB:
		var entries = buttons.filter(func(b): return b.enabled)
		if not entries.is_empty():
			var index = -1
			for i in range(entries.size()):
				if entries[i].id == focus_id: index = i
			focus_id = entries[posmod(index + (-1 if event.shift_pressed else 1), entries.size())].id
		return
	elif event.keycode == KEY_ENTER and focus_id != "":
		for b in buttons:
			if b.id == focus_id and b.enabled:
				_action(b.id, b.data)
				break
		return
	elif event.keycode == KEY_N and screen == "battle":
		_step_action()
		return
	if event.keycode == KEY_F11:
		_toggle_fullscreen()
	elif event.keycode == KEY_F5 and not s.is_empty() and not _command_pending():
		_action("save")
	elif event.keycode == KEY_ESCAPE:
		if screen == "base" and base_panel == "facility": base_panel = "dispatch"
		elif screen=="intel": _navigate("world")
		else: _navigate(library_origin if screen == "library" else "campaign" if screen == "deployment" else "base" if screen != "base" else "settings")
	elif event.keycode == KEY_Q and not s.is_empty():
		_navigate("queues")
	elif event.keycode == KEY_I and not s.is_empty():
		_navigate("inventory")
	elif event.keycode == KEY_SPACE and screen == "battle":
		battle_paused = not battle_paused
	elif event.keycode >= KEY_1 and event.keycode <= KEY_8:
		_navigate(NAV[event.keycode - KEY_1][0])

func _navigate(target):
	if deployment_pending:
		return
	if screen == "library": _library_remember()
	if target == "library" and screen != "library":
		library_origin = screen
		if screen == "battle":
			library_battle_paused = battle_paused
			battle_paused = true
	if screen == "library" and target == "battle": battle_paused = library_battle_paused
	if not deployment.is_empty() and target not in ["deployment", "doctrine", "library"]:
		draft = deployment_backup.get("draft", info.usable).duplicate(true)
		dirty = deployment_backup.get("dirty", false)
		deployment = {}
		deployment_backup = {}
		deployment_retry = {}
	if screen == "army" and dirty:
		toast_message("未保存的编队已保留，返回编队后可继续编辑")
	if screen == "factory": manufacture_quantity = quantity
	var previous_screen = screen
	screen = target
	if target == "base" and previous_screen != "base": base_panel = "dispatch"
	if target == "queues" and previous_screen != "queues":
		queue_page = 0
		if previous_screen in ["factory", "industry"]: dispatch_selected = selected_factory
		elif previous_screen in ["repair", "research"]: dispatch_selected = previous_screen
		elif previous_screen == "world": dispatch_selected = "expeditions"
	if screen == "factory" and previous_screen != "factory": _set_quantity(manufacture_quantity)
	if screen == "reports":
		report_rows = s.reports.duplicate(true)
		report_page = 0
	focus_id = ""
	completion_marks.erase(target)
	if screen == "army" and not dirty:
		draft = info.usable.duplicate(true)
	if screen == "settings":
		request({"op": "list"})
	if screen == "repair":
		repair_page = 0
		repair_history = false
		if s.damaged.get(repair_unit, 0) == 0:
			for u in catalog.unitList:
				if s.damaged.get(u.unitId, 0) > 0:
					repair_unit = u.unitId
					break
		_validate_repair_quantity(true)

func _action(id, data = null):
	if deployment_pending:
		return
	_sound(false)
	if _library_action(id, data): return
	if id.begins_with("resource:"):
		inventory_category = "materials"
		_navigate("inventory")
		return
	if _experience_action(id, data):
		return
	if id.begins_with("basePanel:"):
		base_panel = str(data)
	elif id.begins_with("dispatchSelect:") or id.begins_with("dispatchOpen:"):
		dispatch_selected = str(data)
		queue_page = 0
		if id.begins_with("dispatchOpen:"): _navigate("queues")
	elif id == "dispatchDestination":
		_dispatch_destination()
	elif id.begins_with("dispatchProject:"):
		_dispatch_project(data)
	elif id.begins_with("dispatchMarch:"):
		for i in range(s.marches.size()):
			if s.marches[i].id == data:
				selected_site = s.marches[i].targetId
				march_page = int(i / 2)
				map_resource = "all"
				map_level = 0
				map_intel = "all"
				var target = _site()
				map_center = Vector2(target.x + 0.5, target.y + 0.5)
				_navigate("world")
				break
	elif id.begins_with("nav:"):
		_navigate(data)
	elif id.begins_with("facility:"):
		selected_factory = str(data)
		production_mode = "refit" if selected_factory == "refit" else "produce"
		_navigate("factory")
	elif id.begins_with("facilityUpgrade:"):
		if data == "factory":
			command({"type": "upgrade", "building": "factory"})
		else:
			command({"type": "facilityUpgrade", "facility": data})
	elif id.begins_with("repairUnit:"):
		repair_unit = str(data)
		_validate_repair_quantity(true)
	elif id == "repairFilter":
		repair_history = not repair_history
		repair_page = 0
	elif id == "repairPrev" or id == "repairNext":
		repair_page = maxi(0, repair_page + (-1 if id == "repairPrev" else 1))
	elif id == "repairMax":
		_set_quantity(int(info.unitStats[repair_unit].repair.max))
	elif id == "repairStart":
		command({"type": "repair", "unitId": repair_unit, "count": quantity})
	elif id == "repairOpen":
		repair_unit = _unit_id()
		_navigate("repair")
	elif id.begins_with("building:"):
		selected_building = data
		base_panel = "facility"
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
		_set_quantity(int(_factory_quote().max))
	elif id.begins_with("productionMode:"):
		production_mode = data
		selected_factory = "refit" if data == "refit" else "factory" if selected_factory == "refit" else selected_factory
	elif id == "qtyminus":
		_set_quantity(maxi(1, quantity - 1))
	elif id == "qtyplus":
		_set_quantity(mini(100 if screen=="factory" else 10000, quantity + 1))
	elif id == "produce" or id == "repair":
		command({"type": production_mode if id == "produce" else "repair", "unitId": _unit_id(), "count": quantity, "facility": "refit" if production_mode == "refit" else selected_factory})
	elif id == "reserveNext":
		reserve_page = (reserve_page + 1) % maxi(1,ceili(_reserve_entries().size() / 6.0))
	elif id == "reservePrev":
		reserve_page = maxi(0, reserve_page - 1)
	elif id.begins_with("campaignMode:"):
		campaign_mode = data
	elif id.begins_with("dungeon:"):
		selected_dungeon = int(data)
	elif id == "dungeonAttack" or id == "dungeonTraining":
		_begin_deployment({"type": "dungeon", "dungeonId": catalog.dungeons[selected_dungeon].id, "training": id == "dungeonTraining"})
	elif id.begins_with("researchBranch:"):
		research_branch = str(data)
		for node in catalog.researchTree:
			if node.branch == research_branch:
				selected_tech = node.id
				break
	elif id.begins_with("techSelect:"):
		selected_tech = str(data)
	elif id.begins_with("research:"):
		command({"type": "research", "tech": data})
	elif id.begins_with("slot:"):
		selected_slot = int(data)
		compare_unit = ""
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
	elif id == "deploymentConfirm":
		_confirm_deployment()
	elif id == "deploymentCancel":
		_navigate("world" if deployment.command.type=="march" else "campaign")
	elif id == "deploymentEnemy":
		deployment_enemy = not deployment_enemy
	elif id == "slotmax":
		if draft[selected_slot] != null:
			_assign(draft[selected_slot].unitId)
	elif id == "slotcount":
		if draft[selected_slot] != null:
			_text_prompt("formationCount", str(int(draft[selected_slot].count)))
	elif id == "formationSave":
		command({"type": "formation", "slots": draft})
	elif id == "formationAuto":
		if screen == "deployment":
			draft = info.suggestedFormation.duplicate(true)
			dirty = true
		else:
			dirty = false
			request({"op": "autoFormation"})
	elif id == "presetSave":
		if dirty:
			toast_message("请先保存当前编队，再保存预设")
		else:
			_text_prompt("preset", "新编队 " + str(s.presets.size() + 1))
	elif id.begins_with("presetLoad:"):
		if screen == "deployment":
			draft = s.presets[int(data)].formation.duplicate(true)
			dirty = true
		elif dirty:
			_confirm({"type": "presetLoad", "index": data}, "载入预设将替换当前未保存的编队草稿。\n车辆不会消耗；需要保留草稿时，请取消并先保存编队。")
		else:
			command({"type": "presetLoad", "index": data})
	elif id.begins_with("stage:"):
		selected_stage = int(data)
	elif id == "attack" or id == "training":
		_begin_deployment({"type": "battle", "stage": selected_stage, "training": id == "training"})
	elif id.begins_with("reportSummary:"):
		request({"op": "report", "id": data, "summaryOnly": true})
	elif id == "battlePause":
		battle_paused = not battle_paused
	elif id == "battleSpeed":
		battle_speed = 2.0 if battle_speed == 1.0 else 4.0 if battle_speed == 2.0 else 1.0
	elif id == "battleSkip":
		_seek_battle_end()
	elif id == "battleSettlement":
		settlement_visible = true
	elif id == "battleField":
		settlement_visible = false
	elif id == "rewardPrev" or id == "rewardNext":
		settlement_reward_page = maxi(0, settlement_reward_page + (-1 if id == "rewardPrev" else 1))
	elif id.begins_with("inventoryCategory") :
		inventory_category = data
		inventory_page = 0
		_navigate("inventory")
	elif id.begins_with("inventoryClass") :
		inventory_class = data
		inventory_page = 0
	elif id == "inventoryOwned":
		inventory_owned = not inventory_owned
		inventory_page = 0
	elif id == "inventoryPrev" or id == "inventoryNext":
		inventory_page = maxi(0, inventory_page + (-1 if id == "inventoryPrev" else 1))
	elif id.begins_with("inventoryItem") :
		_inventory_details(data)
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
		request({"op":"previewRest","minutes":int(data)})
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
		_begin_world_deployment(id)
	elif id.begins_with("recall:"):
		_confirm({"type": "recall", "marchId": data}, "召回此部队？\n仅携带已经采到的物资；回到基地后才会入库。")
	elif id == "leadership" or id == "skill" or id == "initiativeSkill" or id == "extraFireSkill" or id == "daily":
		command({"type": id})
	elif id.begins_with("claim:"):
		command({"type": "claim", "questId": data})
	elif id == "questNext":
		quest_page = (quest_page + 1) % 2
	elif id.begins_with("report:"):
		request({"op": "report", "id": data})
	elif id == "reportsNext":
		report_page = mini(report_page + 1, maxi(0, ceili(_filtered_reports().size()/5.0)-1))
	elif id == "reportsPrev":
		report_page = maxi(0, report_page - 1)
	elif id == "savesNext":
		save_page = mini(save_page + 1, maxi(0, int(ceil(saves.size() / 7.0)) - 1))
	elif id == "savesPrev":
		save_page = maxi(0, save_page - 1)
	elif id == "save":
		if screen == "deployment":
			toast_message("战前编队将在确认出战时保存")
			return
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
		_save_preferences()
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
	if mode == "formationCount":
		text_dialog.title = "调整阵位 %d 数量" % (selected_slot + 1)
		name_input.placeholder_text = "输入 1—%d" % mini(info.leadership, _free_for_slot(draft[selected_slot].unitId))
		name_input.max_length = 5
	name_input.text = value
	text_dialog.popup_centered()
	name_input.grab_focus()
	name_input.select_all()

func _text_confirmed():
	if dialog_mode == "formationCount":
		if draft[selected_slot] == null:
			return
		var limit = mini(info.leadership, _free_for_slot(draft[selected_slot].unitId))
		if not name_input.text.is_valid_int() or int(name_input.text) < 1 or int(name_input.text) > limit:
			toast_message("请输入 1—%d 的整数；受统率和可用库存限制" % limit)
			return
		draft[selected_slot].count = int(name_input.text)
		dirty = true
	elif dialog_mode in ["rootLogin", "rootPassword"]:
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
	elif dialog_mode == "presetRename": command({"type":"presetRename","index":preset_index,"name":name_input.text})
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

func _begin_deployment(battle_command: Dictionary):
	if _command_pending() or not deployment.is_empty():
		return
	var target = catalog.stages[int(battle_command.stage)] if battle_command.type == "battle" else catalog.dungeons[selected_dungeon]
	deployment_backup = {"draft": draft.duplicate(true), "dirty": dirty}
	deployment = {"command": battle_command.duplicate(true), "title": target.name, "enemy": target.formation.duplicate(true)}
	deployment.guardTech = int(target.get("guardTech", 0))
	draft = draft.duplicate(true) if dirty else info.usable.duplicate(true)
	dirty = true
	deployment_retry = {}
	deployment_enemy = false
	selected_slot = 0
	reserve_page = 0
	toast_until = 0
	screen = "deployment"

func _deployment_problem():
	var totals = {}
	var count = 0
	for st in draft:
		if st == null:
			continue
		if st.count < 1 or st.count > info.leadership or st.count != int(st.count):
			return "每格需部署 1—%d 辆战车，请调整数量。" % info.leadership
		totals[st.unitId] = totals.get(st.unitId, 0) + st.count
		count += st.count
	for id in totals:
		if totals[id] > s.available.get(id, 0):
			return catalog.units[id].name + "可用库存不足，请调整编队。"
	return "请至少部署一辆战车，再确认出战。" if count == 0 else ""

func _confirm_deployment():
	if deployment.is_empty() or deployment_pending or _command_pending():
		return
	var problem = _deployment_problem()
	if problem != "":
		toast_message(problem)
		return
	var battle_command = deployment.command.duplicate(true)
	battle_command.formation = draft.duplicate(true)
	if deployment_retry.is_empty() or JSON.stringify(deployment_retry.command) != JSON.stringify(battle_command):
		deployment_retry = {"op": "command", "command": battle_command, "id": Crypto.new().generate_random_bytes(12).hex_encode()}
	deployment_pending = true
	request(deployment_retry.duplicate(true))

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
	quantity = clampi(value, 0, 100 if screen=="factory" else 10000)
	quantity_input.text = str(quantity)

func _validate_repair_quantity(reset):
	var maximum = int(info.unitStats[repair_unit].repair.max)
	if reset: _set_quantity(mini(10,maximum))
	elif maximum != repair_limit: _set_quantity(clampi(quantity,1,maximum) if maximum>0 else 0)
	repair_limit = maximum

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


# Classified, read-only reference. Scroll positions belong to article IDs, not dialogs.
func _setup_library():
	library_search = LineEdit.new()
	library_search.position = Vector2(280, 201)
	library_search.size = Vector2(1090, 42)
	library_search.placeholder_text = "搜索机制、属性或关键词，如：闪避、先手、全部修复"
	library_search.max_length = 120
	library_search.add_theme_font_size_override("font_size", 19)
	library_search.text_changed.connect(func(value):
		library_query = value
		library_page = 0
		_library_filter_changed())
	library_search.gui_input.connect(func(event):
		if event is InputEventKey and event.pressed:
			if event.keycode == KEY_ESCAPE:
				library_search.release_focus()
				library_search.accept_event()
			elif event.keycode == KEY_F1:
				library_search.release_focus()
				library_search.accept_event())
	add_child(library_search)
	library_search.hide()
	library_reader = RichTextLabel.new()
	library_reader.position = Vector2(666, 342)
	library_reader.size = Vector2(868, 421)
	library_reader.bbcode_enabled = true
	library_reader.selection_enabled = true
	library_reader.focus_mode = Control.FOCUS_ALL
	library_reader.add_theme_font_override("normal_font", font)
	library_reader.add_theme_font_override("bold_font", bold)
	library_reader.add_theme_color_override("default_color", TEXT)
	library_reader.add_theme_constant_override("line_separation", 7)
	add_child(library_reader)
	library_reader.hide()

func _library_entries():
	return catalog.get("fieldLibrary", {}).get("entries", [])

func _library_entry(id):
	for entry in _library_entries():
		if entry.id == id: return entry
	return {}

func _library_filtered():
	var result = []
	var words = library_query.to_lower().replace("\t", " ").replace("\n", " ").split(" ", false)
	for entry in _library_entries():
		if library_category != "all" and entry.category != library_category: continue
		var haystack = entry.title + " " + entry.summary + " " + entry.keywords
		for section in entry.sections: haystack += " " + section.title + " " + section.text
		var matches = true
		for word in words:
			if not word in haystack.to_lower():
				matches = false
				break
		if matches: result.append(entry)
	return result

func _library_remember():
	if library_rendered != "":
		library_scroll[library_rendered] = library_reader.get_v_scroll_bar().value

func _library_choose(id):
	_library_remember()
	library_selected = id
	var index = _library_filtered().find(_library_entry(id))
	if index >= 0: library_page = int(index / 7.0)
	library_rendered = ""
	_library_sync()

func _library_filter_changed():
	var rows = _library_filtered()
	if rows.is_empty(): _library_choose("")
	elif not rows.any(func(row): return row.id == library_selected): _library_choose(rows[0].id)
	else: library_page = int(rows.find(_library_entry(library_selected)) / 7.0)

func _library_restore(id, position_y):
	await get_tree().process_frame
	await get_tree().process_frame
	if screen == "library" and library_rendered == id:
		library_reader.get_v_scroll_bar().value = position_y

func _library_sync():
	var visible_now = screen == "library" and not s.is_empty()
	library_search.visible = visible_now
	library_reader.visible = visible_now and library_selected != ""
	if not visible_now: return
	if library_scale != ui_scale:
		_library_remember()
		library_scale = ui_scale
		library_reader.add_theme_font_size_override("normal_font_size", roundi(20 * ui_scale))
		library_reader.add_theme_font_size_override("bold_font_size", roundi(21 * ui_scale))
		library_rendered = ""
	if library_selected == library_rendered: return
	var entry = _library_entry(library_selected)
	if entry.is_empty(): return
	var parts: Array[String] = ["[color=#d7b776]" + entry.summary + "[/color]\n"]
	for section in entry.sections:
		parts.append("[b][color=#d7b776]" + section.title + "[/color][/b]\n" + section.text + "\n")
	library_reader.text = "\n".join(parts)
	library_rendered = entry.id
	_library_restore(entry.id, library_scroll.get(entry.id, 0))

func _library_action(id, data):
	id = str(id).split(":")[0]
	if id == "libraryCategory":
		library_category = data
		library_page = 0
		focus_id = ""
		_library_filter_changed()
	elif id == "libraryEntry":
		_library_choose(data)
	elif id == "libraryRelated":
		library_category = "all"
		library_search.text = ""
		library_query = ""
		_library_choose(data)
		library_page = int(_library_filtered().find(_library_entry(data)) / 7.0)
	elif id == "libraryClear":
		library_search.text = ""
		library_query = ""
		library_page = 0
		_library_filter_changed()
	elif id == "libraryPrev": library_page = maxi(0, library_page - 1)
	elif id == "libraryNext": library_page = mini(int((_library_filtered().size() - 1) / 7.0), library_page + 1)
	elif id == "libraryTop": library_reader.get_v_scroll_bar().value = 0
	elif id == "libraryGo":
		if library_selected == "cores": campaign_mode = "dungeon"
		elif library_selected == "campaign": campaign_mode = "stage"
		_navigate(data)
	else: return false
	return true

func _draw_library():
	_title("战地图书馆", "FIELD LIBRARY  /  游戏机制与作战手册")
	_text("当前单机规则 · 公式 / 示例 / 相关入口", Vector2(905, 148), 19, GOLD)
	_button("nav:libraryReturn", "返回上页", Rect2(691, 116, 184, 42), library_origin)
	_text("检索机制", Vector2(55, 229), 22, TEXT, true)
	_button("libraryClear", "清空搜索", Rect2(1384, 201, 176, 42))
	var categories = [{"id":"all","name":"全部内容"}] + catalog.fieldLibrary.categories
	for i in range(categories.size()):
		var category = categories[i]
		var count = _library_entries().filter(func(entry): return category.id == "all" or entry.category == category.id).size()
		_button("libraryCategory:" + category.id, category.name + "  " + str(count), Rect2(40, 265 + i * 58, 220, 46), category.id, library_category == category.id)
	var rows = _library_filtered()
	library_page = clampi(library_page, 0, maxi(0, int((rows.size()-1)/7.0)))
	for i in range(7):
		var index = library_page * 7 + i
		if index >= rows.size(): break
		var entry = rows[index]
		var rect = Rect2(280, 265 + i * 73, 340, 63)
		_panel(rect, Color("344032") if entry.id == library_selected else Color("182421"), GOLD if entry.id == library_selected else LINE)
		_text(entry.title, rect.position + Vector2(16, 28), 18, TEXT, true)
		var category_name = ""
		for category in categories:
			if category.id == entry.category: category_name = category.name
		_small(category_name + "  ·  " + str(entry.sections.size()) + " 节", rect.position + Vector2(16, 51), 14, GOLD)
		_hit("libraryEntry:" + entry.id, rect, entry.id)
	_panel(Rect2(640, 265, 920, 514), PANEL, LINE)
	var entry = _library_entry(library_selected)
	if entry.is_empty():
		_text("没有匹配的条目", Vector2(668, 310), 26, GOLD, true)
		_text("尝试减少关键词，或选择「全部内容」。", Vector2(668, 365), 21, TEXT)
	else:
		_text(entry.title, Vector2(666, 308), 27, TEXT, true)
		_button("libraryTop", "回到顶部", Rect2(1406, 280, 128, 33))
		draw_line(Vector2(666, 324), Vector2(1534, 324), LINE)
		for i in range(mini(2, entry.related.size())):
			var related = _library_entry(entry.related[i])
			_button("libraryRelated:" + related.id, related.title, Rect2(640 + i * 289, 795, 278, 31), related.id)
		_button("libraryGo", entry.destination.label + " →", Rect2(1226, 795, 334, 31), entry.destination.page, true)
	_text("%d 条 · %d / %d 页" % [rows.size(), library_page+1, maxi(1, ceili(rows.size()/7.0))], Vector2(55, 784), 16, GOLD)
	_small("F1 打开 · Ctrl+F 搜索", Vector2(40, 817), 14, MUTED)
	_button("libraryPrev", "上一页", Rect2(280, 795, 164, 31), null, false, library_page > 0)
	_button("libraryNext", "下一页", Rect2(456, 795, 164, 31), null, false, (library_page+1)*7 < rows.size())

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
			"industry": _draw_industry()
			"inventory": _draw_inventory()
			"attributes": _draw_attributes()
			"library": _draw_library()
			"repair": _draw_repair()
			"army", "deployment": _draw_army()
			"objectives": _draw_objectives()
			"presets": _draw_presets()
			"research": _draw_research()
			"campaign": _draw_campaign()
			"world": _draw_world()
			"intel": _draw_intel()
			"commander": _draw_commander()
			"commandTraining": _draw_command_training()
			"reports": _draw_reports()
			"settings": _draw_settings()
			"restReport": _draw_rest_report()
			"doctrine": _draw_doctrine()
			"vip": _draw_vip()
			"queues": _draw_queues()
		_navbar()
	for entry in buttons:
		if entry.id==focus_id: draw_rect(entry.rect.grow(-2),GOLD,false,2)
		if entry.id == hover and not entry.enabled and toast_until <= clock:
			var reason = _disabled_reason(entry.id, entry.data)
			if reason != "":
				_panel(Rect2(260, 778, 1080, 50), Color("242c25"), GOLD)
				_fit_text(reason + "  ·  点击查看解决入口", Vector2(279, 810), 1042, 17, TEXT)
			break
	if hover.begins_with("resource:"):
		var resource = hover.trim_prefix("resource:")
		_panel(Rect2(355,87,1070,40 if resource=="gold" else 77),Color("25322b"),GOLD)
		_text(catalog.resourceNames[resource] + " · 精确可用 " + QuantityFormat.exact(s.wallet[resource]),Vector2(484,114),18,TEXT)
		if resource!="gold":
			var ratio = float(s.wallet[resource])/maxf(1,info.capacity)
			_text("自产容量 "+QuantityFormat.exact(info.capacity)+" · 已用 %.1f%% · "%[ratio*100]+("满仓暂停自产，已获得的奖励和归队物资保留" if ratio>=1 else "点击查看产量、订单占用与运输中物资"),Vector2(375,146),17,GOLD if ratio>=1 else TEXT)
	if toast_until > clock and toast != "":
		var w = minf(1100, maxf(400, font.get_string_size(toast, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x + 54))
		_panel(Rect2((1600 - w) / 2, 92, w, 43), Color("25322b"), GOLD)
		_fit_text(toast, Vector2((1600 - w) / 2 + 26, 120), w-52, 17, TEXT)
	if _modal_open(): draw_rect(Rect2(0,0,1600,900),Color(0.01,0.025,0.02,0.65))

func _modal_open():
	return (is_instance_valid(details_dialog) and details_dialog.visible) or (is_instance_valid(confirm_dialog) and confirm_dialog.visible) or (is_instance_valid(text_dialog) and text_dialog.visible)

func _fit_text(value, pos: Vector2, width: float, size_px=18, color=TEXT, heavy=false):
	var face = bold if heavy else font
	var px = maxi(14,int(round(size_px*ui_scale))) if size_px<=22 else size_px
	var text = str(value)
	while px>14 and face.get_string_size(text,HORIZONTAL_ALIGNMENT_LEFT,-1,px).x>width: px-=1
	if face.get_string_size(text,HORIZONTAL_ALIGNMENT_LEFT,-1,px).x>width:
		while text.length()>0 and face.get_string_size(text+"…",HORIZONTAL_ALIGNMENT_LEFT,-1,px).x>width: text=text.left(-1)
		text+="…"
	draw_string(face,pos,text,HORIZONTAL_ALIGNMENT_LEFT,-1,px,color)

func _text(value, pos: Vector2, size_px = 18, color = TEXT, heavy = false):
	var actual_size = maxi(14, int(round(size_px * ui_scale))) if size_px <= 22 else size_px
	draw_string(bold if heavy else font, pos, str(value), HORIZONTAL_ALIGNMENT_LEFT, -1, actual_size, color)

func _small(value, pos: Vector2, size_px = 13, color = MUTED):
	draw_string(font if str(value).length() != str(value).to_utf8_buffer().size() else latin, pos, str(value), HORIZONTAL_ALIGNMENT_LEFT, -1, maxi(13, size_px), color)

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
	var text_color = TEXT if enabled else Color("a2aaa1")
	var text_size = int(round(18 * ui_scale))
	while text_size > 14 and font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size).x > r.size.x - 16:
		text_size -= 1
	var tw = font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size).x
	draw_string(font, Vector2(r.position.x + (r.size.x - tw) / 2, r.position.y + r.size.y / 2 + text_size * 0.35), label, HORIZONTAL_ALIGNMENT_LEFT, -1, text_size, text_color)
	if focus_id == id:
		draw_rect(r.grow(-3), GOLD, false, 2)
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

func _amount(value):
	return QuantityFormat.compact(value)

func _time(ms):
	var seconds = maxi(0, int(ceil(float(ms) / 1000.0)))
	if seconds >= 86400:
		var minutes = ceili(seconds/60.0)
		return "%d天 %02d:%02d" % [int(minutes/1440.0),int(minutes/60.0)%24,minutes%60]
	return "%02d:%02d:%02d" % [int(seconds / 3600.0), int(seconds / 60.0) % 60, seconds % 60] if seconds >= 3600 else "%02d:%02d" % [int(seconds / 60.0), seconds % 60]

func _cost(cost, pos: Vector2, multiplier = 1):
	var x = pos.x
	for i in range(6):
		var value = int(cost.get(RES[i], 0)) * multiplier
		if value <= 0:
			continue
		_icon(i, Rect2(x, pos.y - 21, 32, 32))
		_text(_amount(value), Vector2(x + 35, pos.y + 2), 16, TEXT if s.wallet[RES[i]] >= value else RED)
		x += 100 if value < 10000 else 120

func _title(title, subtitle, compact = false):
	_small(subtitle, Vector2(40, 105 if compact else 115), 13, GOLD)
	_text(title, Vector2(40, 145 if compact else 158), 32, TEXT, true)
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
	_button("nav:inventory", "资源一览  I", Rect2(28, 42, 159, 29), "inventory", screen == "inventory")
	draw_line(Vector2(203, 16), Vector2(203, 65), LINE)
	for i in range(6):
		var x = 222 + i * 172
		_icon(i, Rect2(x, 14, 53, 53))
		_hit("resource:" + RES[i], Rect2(x, 9, 168, 61), RES[i])
		_text(catalog.resourceNames[RES[i]], Vector2(x + 57, 29), 13, MUTED)
		_small(_amount(s.wallet[RES[i]]), Vector2(x + 57, 55), 24, GOLD if i == 5 else TEXT)
		if i<5:
			var fullness=float(s.wallet[RES[i]])/maxf(1,info.capacity)
			_bar(Rect2(x+57,61,107,6),fullness,GOLD if fullness>=1 else GREEN)
			_small(("超仓 " if fullness>1 else "满仓 " if fullness==1 else "")+"/ "+_amount(info.capacity),Vector2(x+57,79),11,GOLD if fullness>=1 else MUTED)
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
		if completion_marks.has(NAV[i][0]): draw_circle(Vector2(x+142,852),4,GOLD)
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
	var goal = info.progression.next.title + " · " + info.progression.next.condition
	var destination = info.progression.next.page
	_panel(Rect2(24, 667, 770, 49), Color(0.045, 0.075, 0.07, 0.96), LINE)
	_text("下一目标  " + goal.substr(0,42), Vector2(39, 697), 16, GOLD)
	_hit("nav:objective", Rect2(24, 667, 770, 49), destination)
	if not progress_report.is_empty(): _button("lastProgress","上次休整结算",Rect2(30,485,290,39))
	_button("rest:60", "休整 1 小时", Rect2(812, 675, 155, 40), 60)
	_button("rest:480", "休整 8 小时", Rect2(982, 675, 155, 40), 480)
	_button("nav:industry", "工业区 · 制造 / 改装", Rect2(350, 617, 225, 39), "industry")
	_button("nav:repair", "维修车间 · 待修 %d" % info.repairSummary.damaged, Rect2(590, 617, 225, 39), "repair", info.repairSummary.damaged > 0)
	_button("nav:objectives","成长目标 / 挑战荣誉",Rect2(800,102,337,44),"objectives")
	_button("nav:library","战地图书馆  F1",Rect2(480,102,300,44),"library")
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
		if id in ["hq", "lab", "factory"]:
			var station_id = {"hq":"building", "lab":"research", "factory":"factory"}[id]
			var station = _dispatch_station(station_id)
			var badge = Rect2(p.x - 105, p.y + 72, 210, 29)
			_panel(badge, Color("15241e"), GREEN if station.active > 0 else LINE)
			_dispatch_text(("建造" if id == "hq" else "科研" if id == "lab" else "制造") + (" · " + _time(station.nextMs) if station.active > 0 else " · 待命") + "  ›", badge.position + Vector2(9, 21), 192, 15, GREEN if station.active > 0 else MUTED)
			_hit("dispatchOpen:"+station_id, badge, station_id)
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
		_text("+%s / 时" % _amount(info.rates[RES[i]]), Vector2(x + 49, 772), 16)
		_bar(Rect2(x + 49, 784, 90, 3), s.wallet[RES[i]] / info.capacity, GOLD)
		_small("满仓·自产暂停" if s.wallet[RES[i]] >= info.capacity else "容量 " + _amount(info.capacity), Vector2(x + 49, 805), 11, GOLD if s.wallet[RES[i]] >= info.capacity else MUTED)
	_panel(Rect2(1190, 82, 410, 754), Color("111b1c"), LINE)
	_button("basePanel:dispatch", "作业调度", Rect2(1206, 96, 180, 38), "dispatch", base_panel == "dispatch")
	_button("basePanel:facility", "设施详情", Rect2(1396, 96, 188, 38), "facility", base_panel == "facility")
	if base_panel == "dispatch":
		_draw_base_dispatch()
		return
	var b = selected_building
	var level = int(s.buildings[b])
	_text(catalog.buildingNames[b], Vector2(1216, 174), 29, TEXT, true)
	_small("LEVEL %02d" % level, Vector2(1218, 200), 17, GOLD)
	var descriptions = {
		"hq": ["基地的心脏。提升指挥中心等级，", "解锁更先进的设施与装甲部队。"],
		"factory": ["工厂 6 / 14 级开放二、三阶", "60 级开放七阶，继续升级提高效率。"],
		"lab": ["每一次技术突破，", "都会成为战场上的优势。"],
		"warehouse": ["提高资源自然产出的储存上限，", "守住基地的战略储备。"]}
	var lines = descriptions.get(b, ["稳定的物资产出，", "是装甲部队继续前进的保障。"])
	for i in range(lines.size()):
		_text(lines[i], Vector2(1218, 221 + i * 27), 17, MUTED)
	draw_line(Vector2(1218, 274), Vector2(1570, 274), LINE)
	if level>=int(catalog.MAX_LEVEL):
		_text("设施已满级 · 当前收益",Vector2(1218,307),22,GOLD,true)
		var benefit = "其他建筑可提升至 120 级" if b=="hq" else "七阶制造 · 本厂效率 +100%" if b=="factory" else "开放全部现有科研等级" if b=="lab" else "自产容量 %s / 每种资源"%_amount(info.capacity) if b=="warehouse" else "本资源产出 %s / 时"%_amount(info.rates.get(b,0))
		_text(benefit,Vector2(1218,350),18,TEXT)
		_text("下一目标："+info.progression.next.title,Vector2(1218,391),17,MUTED)
		_button("nav:objectives","查看成长计划",Rect2(1218,433,350,44),"objectives",true)
	else:
		_text("升级至 Lv.%02d" % (level + 1), Vector2(1218, 304), 18, GOLD)
		var cost = info.buildingCosts[b].duplicate()
		var crystal_cost = cost.get("crystal", 0)
		cost.erase("crystal")
		_cost(cost, Vector2(1216, 340))
		if b == "lab": _cost({"crystal": crystal_cost}, Vector2(1216, 380))
		_text("预计耗时  " + _eta(info.buildingTimes[b]), Vector2(1218, 418), 20, GOLD)
		var blocked = info.blocks.get(b, "")
		_button("upgrade", "开始升级" if blocked == "" else blocked, Rect2(1218, 433, 350, 44), null, true, blocked == "" and not _command_pending())
	if b == "factory" or b == "lab":
		_button("nav:facility", "进入战车工厂" if b == "factory" else "进入科研中心", Rect2(1218, 488, 350, 36), "factory" if b == "factory" else "research")
	_button("basePanel:back", "返回作业调度 · 全部工位", Rect2(1218, 782, 350, 35), "dispatch")
	_button("upgradeBenefits", "查看升级收益与解锁 →", Rect2(1218,530,350,27),b)
	var own_build = {}
	for job in info.jobs:
		if job.kind == "building" and job.target == b: own_build = job
	_draw_job_card(own_build, Vector2(1218, 570), 350, "本设施建设")
	_draw_dispatch_station(_dispatch_station("research" if b == "lab" else "factory" if b == "factory" else "building"), Rect2(1218, 682, 350, 75), true)

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
	var name = catalog.buildingNames.get(j.target, catalog.techNames.get(j.target, {"factory2": "第二坦克工厂", "refit": "改装工厂"}.get(j.target, "")))
	if catalog.units.has(j.target):
		name = catalog.units[j.target].name
	_text(name + ("  %d/%d" % [j.completed, j.total] if j.total > 1 else ""), pos + Vector2(13, 48), 15)
	_small(_time(j.remainingMs), pos + Vector2(width - 92, 24), 16, GREEN)
	if j.waiting:
		_text("预计 " + _time(j.waitMs) + " 后开工", pos + Vector2(13, 69), 13, MUTED)
	else:
		var fraction = clampf(1-maxf(0,j.dueAt-s.now)/j.duration,0,1)
		_bar(Rect2(pos.x + 13, pos.y + 60, width - 26, 3), (j.completed+fraction)/maxf(1,j.total), GREEN)
	_button("cancel:" + str(int(j.seq)), "取消", Rect2(pos.x + 13, pos.y + 74, 58, 23), {"seq": j.seq}, false, not _command_pending())
	if not j.waiting:
		_button("accelerate:" + str(int(j.seq)), "免费完成" if j.acceleration == 0 else "%d 金币完成" % j.acceleration, Rect2(pos.x + width - 146, pos.y + 74, 134, 23), {"seq": j.seq}, false, s.wallet.gold >= j.acceleration and not _command_pending())

func _draw_queues():
	_title("基地作业调度", "OPERATIONS / WORKSTATIONS")
	_button("nav:vip", "VIP %d · 工位容量" % info.vip.level, Rect2(1050, 111, 242, 47), "vip")
	_button("nav:dispatchBase", "收起 · 返回基地", Rect2(1310, 111, 252, 47), "base")
	var groups = _dispatch_groups()
	for i in range(groups.size()):
		_draw_dispatch_station(groups[i], Rect2(40, 207+i*79, 345, 73), false)
	_text("Q 打开调度 · Esc 返回基地", Vector2(42, 799), 16, MUTED)
	var station = _dispatch_station(dispatch_selected)
	_panel(Rect2(406, 207, 1156, 104), Color("17251f"), GOLD.darkened(0.45))
	_text(station.name, Vector2(427, 243), 26, TEXT, true)
	_text("工作 %d/%d · %s" % [station.active, station.slots, _dispatch_wait_label(station)], Vector2(427, 276), 18, GOLD)
	var finish = "尚未安排任务" if station.finishMs == null else ("全部预计归队 " if station.id == "expeditions" else "全部完成还需 ") + _time(station.finishMs)
	_dispatch_text(finish, Vector2(873, 236), 667, 18, GREEN)
	_button("dispatchDestination", "前往" + ("工业区解锁" if station.block != "" else "安排建设" if station.id == "building" else station.name), Rect2(1170, 258, 365, 39), null, true)
	var rows = station.rows
	var pages = maxi(1, ceili(rows.size()/4.0))
	queue_page = clampi(queue_page, 0, pages-1)
	if rows.is_empty():
		_panel(Rect2(406, 328, 1156, 405))
		_text(station.status, Vector2(441, 393), 32, GOLD, true)
		var explanation = station.block if station.block != "" else "没有执行中的远征，可安排采集或突袭据点。" if station.id == "expeditions" else "待修 %d 辆，前往维修车间安排维修。" % station.damaged if station.damaged > 0 else "当前工位空闲，点击右上方入口安排新作业。"
		_dispatch_text(explanation, Vector2(441, 444), 1070, 21, TEXT)
		_dispatch_text("自动资源生产仍在基地下方显示；满仓时暂停自产。", Vector2(441, 502), 1070, 18, MUTED)
		if station.id == "expeditions": _button("expeditionHistory", "查看归队与入库记录", Rect2(441, 557, 377, 44))
	for i in range(mini(4, rows.size()-queue_page*4)):
		var row = rows[queue_page*4+i]
		var rect = Rect2(406, 328+i*108, 1156, 99)
		if station.id == "expeditions": _draw_dispatch_march(row, rect)
		else: _draw_dispatch_job(row, rect, queue_page*4+i+1-int(station.active))
	var note = "前往阶段按满载估算；战损、矿量和占用可能改变归队时间。" if station.id == "expeditions" else "进度条 = 整批交付；等待任务按提交顺序开工，时间已计 VIP 免费完成。"
	_dispatch_text(note, Vector2(427, 779), 1110, 16, MUTED)
	_button("queuePrev", "上一页", Rect2(1243, 789, 130, 35), null, false, queue_page > 0)
	_button("queueNext", "%d/%d 下一页" % [queue_page+1, pages], Rect2(1387, 789, 174, 35), null, false, queue_page < pages-1)
	if station.id == "expeditions": _button("expeditionHistory", "归队记录", Rect2(406, 789, 204, 35))
	else: _text("当前工位 %d 项 · 待修车辆不计入等待订单" % rows.size(), Vector2(427, 814), 16, MUTED)

func _dispatch_groups():
	return info.dispatch.stations + [info.dispatch.expeditions]

func _dispatch_station(id):
	for station in _dispatch_groups():
		if station.id == id: return station
	return info.dispatch.stations[0]

func _dispatch_text(value, pos: Vector2, width, size_px = 17, color = TEXT):
	var px = maxi(14, int(round(size_px*ui_scale)))
	var text_value = str(value)
	if font.get_string_size(text_value, HORIZONTAL_ALIGNMENT_LEFT, -1, px).x > width:
		while text_value.length() > 0 and font.get_string_size(text_value + "…", HORIZONTAL_ALIGNMENT_LEFT, -1, px).x > width:
			text_value = text_value.left(text_value.length()-1)
		text_value += "…"
	draw_string(font, pos, text_value, HORIZONTAL_ALIGNMENT_LEFT, -1, px, color)

func _dispatch_wait_label(station):
	if station.block != "": return station.block
	if station.waitingSlots > 0: return "等待 %d/%d" % [station.waiting, station.waitingSlots]
	return "无等待队列"

func _draw_dispatch_station(station, rect: Rect2, on_base):
	var id = ("dispatchOpen:" if on_base else "dispatchSelect:") + station.id
	var active = not on_base and station.id == dispatch_selected
	var color = GREEN if station.active > 0 else GOLD if station.damaged > 0 else MUTED
	_panel(rect, Color("29382c") if active or hover == id else Color("172322"), GOLD if active or hover == id else LINE)
	draw_rect(Rect2(rect.position, Vector2(3, rect.size.y)), color)
	var p = rect.position + Vector2(12, 0)
	_dispatch_text(station.name, p+Vector2(0, 23), 191, 17, TEXT)
	_dispatch_text(("工作 %d/%d" % [station.active, station.slots]) if station.active > 0 else station.status, p+Vector2(202, 23), rect.size.x-225, 15, color)
	var current = station.block if station.block != "" else "待修 %d 辆 · 尚未安排" % station.damaged if station.damaged > 0 else "空闲 · 点击安排作业"
	if station.active > 0:
		if station.id == "expeditions": current = "最近预计归队 " + _time(station.nextMs)
		else:
			var next = station.rows[0]
			for j in station.rows:
				if not j.waiting and j.remainingMs < next.remainingMs: next = j
			current = next.name + " · " + _time(station.nextMs)
	_dispatch_text(current, p+Vector2(0, 45), rect.size.x-24, 15, color)
	var queue_label = _dispatch_wait_label(station)
	if station.id == "expeditions": queue_label = "采集 / 突袭 · 点击查看各队阶段"
	elif station.block != "": queue_label = "点击查看解锁与建设入口"
	elif station.waiting > 0: queue_label += " · 下项 " + station.rows[station.active].name
	elif station.id == "repair": queue_label = "待修 %d 辆 · 独立维修线" % station.damaged
	elif station.id == "building": queue_label = "%d 个并行施工位 · 点击展开" % station.slots
	_dispatch_text(queue_label, p+Vector2(0, 65), rect.size.x-24, 14, GOLD if station.waiting > 0 else MUTED)
	_hit(id, rect, station.id)

func _draw_base_dispatch():
	_text("全基地作业", Vector2(1210, 174), 27, TEXT, true)
	_dispatch_text("工作 %d 项 · 等待 %d 项 · 点击逐级展开" % [info.dispatch.active, info.dispatch.waiting], Vector2(1210, 201), 375, 16, GOLD)
	var groups = _dispatch_groups()
	for i in range(groups.size()): _draw_dispatch_station(groups[i], Rect2(1207, 216+i*81, 377, 75), true)
	_button("nav:dispatchAll", "展开调度中心  Q", Rect2(1207, 792, 377, 31), "queues")

func _dispatch_destination():
	var station = _dispatch_station(dispatch_selected)
	if station.id == "building":
		_navigate("base")
		base_panel = "facility"
	elif station.block != "": _navigate("industry")
	elif station.get("kind", "") == "production": _action("facility:"+station.id, station.id)
	else: _navigate(station.page)

func _dispatch_project(j):
	if j.kind == "building":
		if catalog.buildingNames.has(j.target):
			_navigate("base")
			selected_building = j.target
			base_panel = "facility"
		else: _navigate("industry")
	elif j.kind == "research":
		selected_tech = j.target
		for node in catalog.researchTree:
			if node.id == j.target: research_branch = node.branch
		_navigate("research")
	elif j.kind == "repair":
		repair_unit = j.target
		_navigate("repair")
	else:
		selected_class = CLASSES.find(catalog.units[j.target].classId)
		tier = int(catalog.units[j.target].tier)
		_action("facility:"+j.get("facility", "factory"), j.get("facility", "factory"))

func _draw_dispatch_job(j, rect: Rect2, order):
	_panel(rect, Color("172322"), LINE)
	var p = rect.position + Vector2(15, 0)
	var status = "等待 #%d" % order if j.waiting else "施工中" if j.kind == "building" else "研究中" if j.kind == "research" else "作业中"
	_dispatch_text(status + " · " + j.name, p+Vector2(0, 28), 677, 20, GOLD if j.waiting else TEXT)
	_dispatch_text("距完成 " + _time(j.remainingMs), p+Vector2(729, 28), 394, 18, GREEN)
	var detail = "预计 " + _time(j.waitMs) + " 后开工" if j.waiting else "已交付 %d / %d 辆" % [j.completed, j.total] if j.kind in ["production", "repair"] else "本项目进度 %d%%" % int(j.progress*100)
	_dispatch_text(detail, p+Vector2(0, 61), 635, 17, MUTED)
	_bar(Rect2(p.x, p.y+79, 653, 5), j.progress, GOLD if j.waiting else GREEN)
	_button("dispatchProject:"+str(int(j.seq)), "查看项目", Rect2(p.x+681, p.y+49, 129, 34), j)
	_button("cancel:"+str(int(j.seq)), "取消", Rect2(p.x+823, p.y+49, 85, 34), {"seq": j.seq}, false, not _command_pending())
	if not j.waiting: _button("accelerate:"+str(int(j.seq)), "免费完成" if j.acceleration == 0 else "%s 金币完成" % _amount(j.acceleration), Rect2(p.x+921, p.y+49, 204, 34), {"seq": j.seq}, false, s.wallet.gold >= j.acceleration and not _command_pending())

func _draw_dispatch_march(m, rect: Rect2):
	_panel(rect, Color("172322"), LINE)
	var p = rect.position+Vector2(15, 0)
	_dispatch_text(m.name + " · " + m.targetName + " [%d,%d] · " % [m.x, m.y] + m.phaseName, p+Vector2(0, 27), 732, 19, TEXT)
	_dispatch_text("预计归队 " + _time(m.returnMs), p+Vector2(762, 27), 360, 18, GREEN)
	_dispatch_text("本段 " + _time(m.phaseMs) + " · %d 辆 · 携带 %s / %s" % [m.count, _amount(m.held), _amount(m.capacity)], p+Vector2(0, 60), 750, 17, GOLD)
	_bar(Rect2(p.x, p.y+78, 737, 5), m.progress, GREEN)
	_button("dispatchMarch:"+m.id, "定位队伍", Rect2(p.x+774, p.y+47, 171, 38), m.id)
	_button("recall:"+m.id, "返航中" if m.phase == "returning" else "召回", Rect2(p.x+958, p.y+47, 164, 38), m.id, false, m.phase != "returning" and not _command_pending())

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
	_text("每座工厂 / 科研分别计算", Vector2(405, 346), 11, MUTED)
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
	var perks = ["生产速度 +%d%% · 改装速度 +%d%%" % [v.production, v.refit], "科研速度 +%d%% · 行军速度 +%d%%" % [v.research, v.marchSpeed], "战役经验 +%d%% · 仓储容量 +%d%%" % [v.xp, v.storage], "整批作业 / 采集余时 ≤ %d 分钟自动完成" % v.freeMinutes]
	for i in range(perks.size()):
		_text(perks[i], Vector2(1070, 282 + i * 33), 16, TEXT)
	_button("vipDaily", "领取每日 VIP 补给 · %d 金币" % v.dailyGold, Rect2(1068, 407, 470, 43), null, true, v.dailyAvailable and not _command_pending())
	draw_line(Vector2(1068, 474), Vector2(1536, 474), LINE)
	if settings_advanced:
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
	else:
		_text("本机管理入口位于设置 → 高级。",Vector2(1070,530),19,MUTED)
		_text("免费时长不抵扣往返行军。",Vector2(1070,583),20,GOLD)
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
	for i in range(3):
		var id = ["factory", "factory2", "refit"][i]
		var f = info.facilities[id]
		_button("facility:" + id, f.name + " · " + ("Lv.%d" % f.level if f.level > 0 else "未建"), Rect2(670 + i * 226, 111, 213, 47), id, ("refit" if production_mode == "refit" else selected_factory) == id)
	_button("nav:industry", "工业区", Rect2(1360, 111, 202, 47), "industry")
	for i in range(4):
		_button("class:" + str(i), catalog.classNames[CLASSES[i]], Rect2(40 + i * 284, 200, 269, 60), i, selected_class == i)
	for t in range(1, 8):
		var gate = int(catalog.units[CLASSES[selected_class]+"_t"+str(t)].unlock.factoryLevel)
		_button("tier:" + str(t), ["I 轻型", "II 中型", "III 重型", "IV 进阶", "V 主力", "VI 核心", "VII 精密"][t - 1]+" ·%d级"%gate, Rect2(40 + (t - 1) * 163, 278, 150, 42), t, tier == t)
	var u = catalog.units[_unit_id()]
	var effective = info.unitStats[u.unitId]
	var quote = _factory_quote()
	_panel(Rect2(40, 339, 615, 434), Color("162020"), LINE)
	_text("第 %d 阶 · %s工厂 %d 级解锁" % [tier,"改装及制造" if production_mode=="refit" else "本",u.unlock.factoryLevel], Vector2(65, 370), 17, GOLD)
	_text(u.name, Vector2(65, 410), 30, TEXT, true)
	for i in range(8):
		draw_line(Vector2(50 + i * 84, 716), Vector2(350 + (i - 4) * 20, 475), Color(0.6, 0.68, 0.6, 0.06))
	if production_mode=="refit" and quote.sourceUnitId!="":
		for side in range(2):
			var id=quote.sourceUnitId if side==0 else u.unitId
			var st=info.unitStats[id]
			var p=Vector2(60+side*293,434)
			_panel(Rect2(p,Vector2(280,259)),Color("111c1b"),LINE if side==0 else GOLD.darkened(0.4))
			_image(id,Rect2(p+Vector2(7,20),Vector2(266,145)))
			_text(catalog.units[id].name,p+Vector2(12,187),18,TEXT,true)
			_text("攻击 %d · 生命 %d"%[st.attack,st.hp],p+Vector2(12,215),16,GOLD)
			_text(("消耗 %d 辆原车" if side==0 else "产出 %d 辆新车")%quantity,p+Vector2(12,241),17,MUTED)
	else:
		_image(u.unitId, Rect2(63, 417, 568, 284))
	_text("攻击 %d    生命 %d    载重 %d" % [effective.attack, effective.hp, effective.load], Vector2(65, 726), 18, GOLD)
	_text(catalog.classDescriptions[u.classId], Vector2(65, 757), 16, MUTED)
	_panel(Rect2(677, 339, 496, 434), Color("101a1b"), LINE)
	_button("productionMode:produce", "制造新车", Rect2(696, 355, 217, 39), "produce", production_mode == "produce")
	_button("productionMode:refit", "低阶改装", Rect2(926, 355, 227, 39), "refit", production_mode == "refit")
	_text("待命 %d   出征 %d   待修 %d" % [s.available[u.unitId], effective.marching, s.damaged[u.unitId]], Vector2(696, 420), 16, GOLD)
	_text(("每辆消耗原车 ×1 · 单批最多100辆") if quote.sourceUnitId != "" else "生产数量（可直接输入 1–100）", Vector2(696, 447), 16, MUTED)
	_button("qtyminus", "−", Rect2(696, 465, 40, 42))
	_button("qtyplus", "+", Rect2(872, 465, 40, 42))
	_text("当前最多 %d 辆" % quote.max, Vector2(935, 492), 16, GOLD)
	for i in range(3):
		_button("quantity:" + str(i), str([20, 50, 100][i]), Rect2(696 + i * 116, 520, 105, 39), [20, 50, 100][i])
	_button("quantityMax", "MAX", Rect2(1044, 520, 109, 39))
	var no_refit = production_mode=="refit" and quote.sourceUnitId==""
	_fit_text("轻型车没有低阶原型" if no_refit else ("解锁后预计 " if quote.block!="" else "预计完成 ")+_eta(quote.waitMs+_effective_time(quote.duration*quantity)),Vector2(696,590),457,21,TEXT,true)
	_fit_text("选择 II 阶及以上车辆，查看改装计划" if no_refit else "单辆 " + _time(quote.duration) + " · 等待 " + _time(quote.waitMs) + " · VIP 免 %d 分钟" % info.vip.freeMinutes if quantity > 0 else "请输入 1–100 的整数数量", Vector2(696, 615),457,15,MUTED)
	if not no_refit:
		_cost({"iron": quote.unitCost.get("iron", 0), "oil": quote.unitCost.get("oil", 0), "lead": quote.unitCost.get("lead", 0)}, Vector2(696, 650), quantity)
		_cost({"titanium": quote.unitCost.get("titanium", 0), "crystal": quote.unitCost.get("crystal", 0)}, Vector2(696, 687), quantity)
	if quote.has("coreCost"):
		var core_id = quote.coreCost.id
		_core_icon(core_id, Rect2(949, 661, 33, 33))
		_text("核心 %s / %s" % [_amount(s.arsenal.cores[core_id]), _amount(quantity)], Vector2(986, 686), 16, GOLD if s.arsenal.cores[core_id] >= quantity else RED)
	var label = quote.block.split("（")[0] if quote.block != "" else "等待位已满" if quote.busy else "加入等待队列" if quote.waitMs > 0 else ("开始改装" if production_mode == "refit" else "投入生产")
	_button("produce", label, Rect2(696, 713, 272, 43), null, true, quote.block == "" and quantity > 0 and quantity <= quote.max and not quote.busy and not _command_pending())
	_button("repairOpen", "维修车间", Rect2(981, 713, 172, 43))
	_panel(Rect2(1202, 199, 360, 574), Color("121c1d"), LINE)
	_text("后勤调度", Vector2(1224, 237), 22, TEXT, true)
	_facility_job("refit" if production_mode == "refit" else selected_factory, Vector2(1218, 259), 327)
	_job("repair", Vector2(1218, 400), 327)
	_text("核心储备 · 查看全部 →", Vector2(1224, 529), 18, GOLD)
	_hit("inventoryCategory", Rect2(1220, 506, 329, 34), "cores")
	for i in range(2):
		var core_id = u.classId + "_core" + str(i + 6)
		_core_icon(core_id, Rect2(1224, 545 + i * 52, 42, 42))
		_text(catalog.coreNames[core_id], Vector2(1276, 567 + i * 52), 16, TEXT)
		_small("×" + _amount(s.arsenal.cores[core_id]), Vector2(1494, 568 + i * 52), 18, GOLD)
	_text("取消：退回未完成的资源、核心与原车。", Vector2(1224, 678), 14, MUTED)
	var repair_count = mini(quantity,int(effective.repair.max))
	_fit_text("本车型暂无待修车辆" if s.damaged[u.unitId]<=0 else "维修车间工作中 · 查看维修队列" if effective.repair.busy else "当前可修 %d 辆 · %s"%[repair_count,_eta(_effective_time(effective.repair.duration*repair_count))],Vector2(1224,713),316,15,GOLD)
	if s.damaged[u.unitId]>0 and repair_count>0: _cost(effective.repair.unitCost, Vector2(1220, 747), repair_count)
	_button("nav:queues", "查看全部作业队列", Rect2(310, 786, 270, 33), "queues")
	_button("coreDungeons", "核心副本", Rect2(40, 786, 125, 33))
	_button("budget", "成本计划", Rect2(176,786,120,33),null,false,tier>=6)
	if production_mode == "refit": _button("refitCompare","原车 → 目标 · 对比计划",Rect2(602,786,570,33))
	_button("unitGuide", "兵种图鉴 / 克制 / 实际属性", Rect2(1202, 786, 360, 33))

func _factory_quote():
	return info.unitStats[_unit_id()]["refit" if production_mode == "refit" else "produce2" if selected_factory == "factory2" else "produce"]

func _facility_job(id, pos: Vector2, width):
	var f = info.facilities[id]
	var current = {}
	for j in info.jobs:
		if j.kind == "production" and j.get("facility", "factory") == id and not j.waiting:
			current = j
			break
	_draw_job_card(current, pos, width, f.name + " · 等待 %d/%d" % [f.waiting, f.waitingSlots])
	var next_job = {}
	for j in info.jobs:
		if j.kind == "production" and j.get("facility", "factory") == id and j.waiting:
			next_job = j
			break
	var next_text = "下一项：无等待项目"
	if not next_job.is_empty(): next_text = "下项：%s ×%d · %s" % [catalog.units[next_job.target].name,next_job.total,_time(next_job.remainingMs)]
	_text(next_text, pos + Vector2(4,123), 14, MUTED)

func _draw_industry():
	_title("基地工业区", "INDUSTRY  /  MANUFACTURE · REFIT · RECOVERY")
	_text("指挥中心 Lv.%d" % s.buildings.hq, Vector2(1350, 148), 21, GOLD)
	var ids = ["factory", "factory2", "refit", "repair"]
	for i in range(4):
		var id = ids[i]
		var p = Vector2(40 + (i % 2) * 775, 201 + int(i / 2.0) * 289)
		var repair = id == "repair"
		var f = {"name": "维修车间", "level": 1, "block": ""} if repair else info.facilities[id]
		_panel(Rect2(p, Vector2(746, 268)), Color("14201e"), GOLD.darkened(0.5) if f.level > 0 else LINE)
		_small("0%d / %s" % [i + 1, "RECOVERY" if repair else "REFIT" if id == "refit" else "MANUFACTURING"], p + Vector2(22, 26), 13, GOLD)
		_text(f.name, p + Vector2(22, 66), 29, TEXT, true)
		_text("开局开放" if repair else "Lv.%02d" % f.level if f.level > 0 else "待建设 · 指挥中心 13 级开放", p + Vector2(267, 64), 19, GOLD if f.block == "" else MUTED)
		var description = "集中接收可维修战损，修复完成逐辆返回待命库存。" if repair else "消耗低一阶原车，升级为更高阶战车；独立工作。" if id == "refit" else "制造四类战车；由本厂等级决定可生产的阶级。"
		_text(description, p + Vector2(22, 99), 16, MUTED)
		if repair:
			_text("待修 %d 辆    维修中 %d 辆    永久损失 %d 辆" % [info.repairSummary.damaged, info.repairSummary.repairing, info.repairSummary.destroyed], p + Vector2(22, 141), 20, GOLD)
			_text("独立 1 条维修线 · 不占制造、改装或科研队列", p + Vector2(22, 174), 17, TEXT)
			_button("nav:repair", "进入维修车间", Rect2(p + Vector2(22, 211), Vector2(700, 39)), "repair", true)
		else:
			_text("工作 %d / %d    VIP 等待 %d / %d" % [f.active, 1 if f.level > 0 else 0, f.waiting, f.waitingSlots], p + Vector2(22, 136), 18, GOLD)
			var q = f.upgrade
			var full = f.level >= int(catalog.MAX_LEVEL)
			if not full:
				_cost(q.unitCost, p + Vector2(22, 173))
			else:
				_text("七阶已开放 · 本厂效率 +%d%%"%q.speedPercent,p+Vector2(22,173),17,GOLD)
			var timing = "已达最高等级" if full else ("施工剩余 " + _eta(q.booked.remainingMs)) if q.booked != null else "预计完成 " + _eta(q.waitMs + _effective_time(q.duration))
			_text(timing, p + Vector2(477, 173), 16, GREEN)
			var block = q.block
			if block == "" and not _affordable(q.unitCost):
				block = "资源不足"
			_button("facilityUpgrade:" + id, block if block != "" else "升级本厂" if f.level > 0 else "建设本厂", Rect2(p + Vector2(22, 211), Vector2(337, 39)), id, false, block == "" and not _command_pending())
			_button("facility:" + id, "进入车间", Rect2(p + Vector2(375, 211), Vector2(347, 39)), id, true, f.level > 0)
	_text("两座制造工厂 + 一座改装工厂 = 最多 3 条同时工作的装甲生产线；VIP 为每条线分别增加等待位。", Vector2(42, 811), 17, MUTED)

func _draw_repair():
	_title("装甲维修车间", "RECOVERY  /  RETURN TO THE FRONT")
	_button("nav:industry", "返回工业区", Rect2(1342, 111, 220, 47), "industry")
	var summary = info.repairSummary
	_repair_all_button(Rect2(680,111,640,47))
	if info.repairAll.count>0:
		var shortfall=_missing_resources(info.repairAll.cost)
		if shortfall!="": _fit_text(shortfall+" · 点击上方查看资源",Vector2(680,183),640,16,RED)
	var labels = ["等待维修", "维修作业中", "累计永久损失"]
	var values = [summary.damaged, summary.repairing, summary.destroyed]
	for i in range(3):
		var p = Vector2(40 + i * 319, 200)
		_panel(Rect2(p, Vector2(301, 64)))
		_text(labels[i], p + Vector2(17, 29), 16, MUTED)
		_text("%d 辆" % values[i], p + Vector2(17, 56), 23, RED if i == 2 else GOLD, true)
	var rows: Array = []
	for u in catalog.unitList:
		if s.damaged[u.unitId] > 0 or info.unitStats[u.unitId].repairing > 0 or (repair_history and s.destroyedUnits[u.unitId] > 0):
			rows.append(u)
	_button("repairFilter","全部战损记录 · 切换当前待修" if repair_history else "当前待修 / 维修中 · 查看历史",Rect2(40,274,325,28),null,not repair_history)
	_fit_text(("历史与当前共 %d 类" if repair_history else "当前需处理 %d 类")%rows.size()+" · 永久损失无法修复",Vector2(388,295),587,15,MUTED)
	var pages = maxi(1, ceili(rows.size() / 8.0))
	repair_page = mini(repair_page, pages - 1)
	if rows.is_empty():
		_panel(Rect2(40, 312, 938, 428), Color("14201e"))
		_image("tank_t1", Rect2(335, 338, 300, 189))
		_text("当前没有待修或维修中的车辆", Vector2(302, 575), 24, TEXT, true)
		_text("可切换历史记录；永久损失无法修复。", Vector2(285, 618), 17, MUTED)
	else:
		for i in range(mini(8, rows.size() - repair_page * 8)):
			var u = rows[repair_page * 8 + i]
			var p = Vector2(40 + (i % 2) * 477, 312 + int(i / 2.0) * 106)
			_panel(Rect2(p, Vector2(461, 99)), Color("28382b") if repair_unit == u.unitId else Color("14201e"), GOLD if repair_unit == u.unitId else LINE)
			_image(u.unitId, Rect2(p + Vector2(9, 9), Vector2(133, 80)))
			_text(u.name, p + Vector2(151, 30), 19, TEXT, true)
			_text("待修 %d    维修中 %d" % [s.damaged[u.unitId], info.unitStats[u.unitId].repairing], p + Vector2(151, 59), 16, GOLD)
			_text("累计永久损失 %d" % s.destroyedUnits[u.unitId], p + Vector2(151, 84), 14, MUTED)
			_hit("repairUnit:" + u.unitId, Rect2(p, Vector2(461, 99)), u.unitId)
	_button("repairPrev", "上一页", Rect2(40, 756, 145, 37), null, false, repair_page > 0)
	_button("repairNext", "%d / %d 下一页" % [repair_page + 1, pages], Rect2(200, 756, 195, 37), null, false, repair_page < pages - 1)
	_text("点击车型调整数量；MAX按当前材料计算。", Vector2(424, 782), 15, MUTED)
	_panel(Rect2(1003, 200, 559, 593), Color("101b1a"), LINE)
	var u = catalog.units[repair_unit]
	var quote = info.unitStats[repair_unit].repair
	_text(u.name, Vector2(1025, 239), 27, TEXT, true)
	_image(u.unitId, Rect2(1190, 246, 310, 173))
	_text("待修 %d 辆" % s.damaged[repair_unit], Vector2(1025, 288), 21, GOLD)
	_text("当前可修 %d" % quote.max, Vector2(1025, 323), 17, GREEN)
	_text("修复后回到待命库存", Vector2(1025, 354), 14, MUTED)
	_text("维修数量", Vector2(1025, 430), 17, MUTED)
	_button("qtyminus", "−", Rect2(1025, 445, 75, 42))
	_button("qtyplus", "+", Rect2(1252, 445, 75, 42))
	_button("repairMax", "全部可修 MAX", Rect2(1347, 445, 189, 42))
	_text("暂无可维修车辆" if s.damaged[repair_unit]<=0 else "预计耗时 " + _eta(_effective_time(quote.duration * quantity)), Vector2(1025, 518), 23, TEXT, true)
	_text("VIP 免 %d 分钟 · 按整批剩余时间判断" % info.vip.freeMinutes, Vector2(1025, 544), 15, MUTED)
	if s.damaged[repair_unit]>0: _cost(quote.unitCost, Vector2(1025, 578), quantity)
	_button("repairStart", "维修线正在工作" if quote.busy else "暂无待修车辆" if s.damaged[repair_unit] == 0 else "开始修复 %d 辆" % quantity, Rect2(1025, 605, 511, 43), null, true, not quote.busy and quantity > 0 and quantity <= quote.max and not _command_pending())
	if quote.busy or quantity<=0 or quantity>quote.max: _text(_disabled_reason("repairStart",null),Vector2(1025,666),15,RED)
	_job("repair", Vector2(1025, 671), 511)
	_text("正式战损：同型号合计 ×80% 向上取整可维修；其余永久损失。演习不消耗战车。", Vector2(43, 818), 16, MUTED)

func _formation_tactics(formation, player_side):
	var initiative = 0
	var extra = 0
	var occupied = 0
	for st in formation:
		if st == null or st.count <= 0:
			continue
		var stats = info.unitStats[st.unitId]
		var guard_tech = deployment.get("guardTech",0) if not player_side else 0
		initiative += stats.initiative if player_side else stats.baseInitiative + guard_tech*3
		extra += stats.extraFire if player_side else stats.baseExtraFire + guard_tech*4
		occupied += 1
	return {"initiative": int(floor(float(initiative) / maxi(1, occupied))), "extraFire": int(floor(float(extra) / maxi(1, occupied)))}

func _draw_army():
	var deploying = screen == "deployment" and not deployment.is_empty()
	_title("战前编队 · " + deployment.title if deploying else "作战编队", "PRE-BATTLE DEPLOYMENT  /  REVIEW · ADJUST · CONFIRM" if deploying else "BATTLE GROUP  /  SIX POSITION DOCTRINE",true)
	_text("单格上限  %d 辆" % int(info.leadership), Vector2(1360, 148), 19, GOLD)
	var own_stats = _formation_tactics(draft, true)
	_button("tacticRules","先手 / 二次开火规则",Rect2(1080,155,480,25))
	_button("powerDetails","战力 %s / 满编上限 %s"%[_amount(_formation_power(draft,true)),_amount(info.power.ceiling)],Rect2(535,201,321,28))
	_button("formationPower","最大战力",Rect2(298,201,110,28))
	_button("formationTier","最高兵阶",Rect2(417,201,110,28))
	if deploying:
		var enemy_stats = _formation_tactics(deployment.enemy, false)
		var chance = clampf(10 + (own_stats.extraFire - enemy_stats.extraFire) * 0.1, 0, 35)
		if deployment.get("unknown",false): _text("我方先手 %d · 二次开火 %d；敌情未知，出征可能遭遇战损。"%[own_stats.initiative,own_stats.extraFire],Vector2(43,175),17,GOLD)
		else:
			_text("我方先手 %d / 敌方 %d  ·  %s   |   二次开火 %d / %d  ·  我方 %.1f%%" % [own_stats.initiative, enemy_stats.initiative, "我方先攻" if own_stats.initiative >= enemy_stats.initiative else "敌方先攻", own_stats.extraFire, enemy_stats.extraFire, chance], Vector2(43, 175), 16, GOLD)
	else:
		_text("当前编队：先手 %d · 二次开火 %d（实际概率取决于对手）" % [own_stats.initiative, own_stats.extraFire], Vector2(43, 175), 13, GOLD)
	_text("前排  /  FRONT LINE", Vector2(47, 219), 16, GOLD)
	for i in range(6):
		var p = Vector2(40 + (i % 3) * 279, 236 + int(i / 3.0) * 243)
		var active = selected_slot == i
		_panel(Rect2(p, Vector2(265, 219)), Color("232e28") if active else Color("151f20"), GOLD if active else LINE)
		_small("0" + str(i + 1), p + Vector2(15, 28), 20, GOLD)
		var st = draft[i] if draft.size() == 6 else null
		_small("战力 "+_amount(info.power.units[st.unitId]*st.count) if st!=null else "空位",p+Vector2(116,27),14,GOLD)
		if st != null:
			var unit = catalog.units[st.unitId]
			var actual = info.unitStats[st.unitId]
			_image(unit.unitId, Rect2(p + Vector2(10, 28), Vector2(162, 86)))
			_text("×%d" % st.count, p+Vector2(187,77),24,GOLD,true)
			_text(unit.name, p+Vector2(14,127),19,TEXT,true)
			_text("攻击 %d · 单车生命 %d" % [actual.attack,actual.hp],p+Vector2(14,153),15,GOLD)
			_text("总生命 %s · 载重 %s" % [_amount(actual.hp*st.count),_amount(actual.load*st.count)],p+Vector2(14,179),15,TEXT)
			_fit_text({"tank":"逐列1–3发","tank_destroyer":"对列单体","spg":"对列1–2发","rocket":"固定6发"}[unit.classId]+" · 对"+{"tank":"火箭","tank_destroyer":"坦克","spg":"歼击","rocket":"火炮"}[unit.classId]+" +25%",p+Vector2(14,204),238,14,MUTED)
		else:
			_small("+", p + Vector2(112, 117), 44, LINE.lightened(0.3))
			_text("选择右侧战车部署", p + Vector2(52, 179), 15, MUTED)
		_hit("slot:" + str(i), Rect2(p, Vector2(265, 219)), i)
	_text("后排  /  SUPPORT LINE", Vector2(47, 473), 14, GOLD)
	if deploying:
		_button("formationAuto", "自动满编", Rect2(40, 725, 148, 44))
		_button("slotclear", "清空阵位", Rect2(202, 725, 141, 44))
		_button("slotminus", "−", Rect2(357, 725, 53, 44))
		_button("slotplus", "+", Rect2(424, 725, 53, 44))
		_button("slotcount", "输入数量", Rect2(491, 725, 162, 44), null, false, draft[selected_slot] != null)
		_button("slotmax", "MAX", Rect2(667, 725, 190, 44), null, false, draft[selected_slot] != null)
		var problem = _deployment_problem()
		_button("deploymentCancel", "← 返回世界" if deployment.command.type=="march" else "← 返回战役", Rect2(40, 783, 215, 42))
		_text("演习 · 无战损" if deployment.command.training else "远征 · 返城后入库" if deployment.command.type=="march" else "正式出战 · 结算战损", Vector2(276, 810), 16, GOLD)
		_button("deploymentConfirm", "正在出战…" if deployment_pending else "确认出征" if deployment.command.type=="march" else "确认演习" if deployment.command.training else "确认出战", Rect2(569, 783, 288, 42), null, true, problem == "" and not deployment_pending and not _command_pending())
		if problem!="": _text(problem,Vector2(43,777),13,RED)
	else:
		_button("formationAuto", "自动满编", Rect2(40, 725, 147, 47))
		_button("formationSave", "保存编队" + (" *" if dirty else ""), Rect2(201, 725, 167, 47), null, true, not _command_pending())
		_button("presetSave", "保存预设", Rect2(382, 725, 144, 47))
		_button("slotclear", "清空阵位", Rect2(540, 725, 141, 47))
		_button("slotminus", "−", Rect2(695, 725, 55, 47))
		_button("slotplus", "+", Rect2(762, 725, 55, 47))
		_button("slotcount","输入数量",Rect2(40,787,143,35),null,false,draft[selected_slot]!=null)
		_button("slotmax","补齐本格",Rect2(196,787,142,35),null,false,draft[selected_slot]!=null)
		_button("nav:doctrine","六格攻击图解",Rect2(350,787,209,35),"doctrine")
		_button("nav:inventory","完整库存口径",Rect2(573,787,245,35),"inventory")
	_panel(Rect2(906, 199, 654, 596), Color("111b1c"), LINE)
	_text("敌军部署" if deploying and deployment_enemy else "待命装甲", Vector2(929, 236), 24, TEXT, true)
	if deploying:
		_button("deploymentEnemy", "返回待命部队" if deployment_enemy else "查看敌军部署", Rect2(1097, 215, 179, 36), null, deployment_enemy)
	if deploying and deployment_enemy:
		_mini_formation(deployment.enemy, Vector2(925, 283), Vector2(194, 170))
		_text("过期情报仅供参考；建议重新侦察。" if deployment.get("stale",false) else "先核对敌方阵位，再安排己方前后排。", Vector2(929, 682), 17, RED if deployment.get("stale",false) else GOLD)
		_text("坦克横排 · 歼击单体 · 火炮纵列 · 火箭全体", Vector2(929, 716), 16, MUTED)
		if deployment.get("unknown",false): _text("守军未知；这里不显示实时隐藏部队。",Vector2(929,646),20,RED,true)
		if not deployment.get("unknown",false):
			var own_hp = 0
			var enemy_hp = 0
			for st in draft:
				if st!=null: own_hp += info.unitStats[st.unitId].hp * st.count
			for st in deployment.enemy:
				if st!=null: enemy_hp += int(floor(catalog.units[st.unitId].hp*(1+deployment.get("guardTech",0)*0.08))) * st.count
			_text("我方 / 已知敌方生命 %s / %s · %s" % [_amount(own_hp),_amount(enemy_hp),"承伤储备偏低" if own_hp<enemy_hp else "需结合克制判断"],Vector2(929,646),17,RED if own_hp<enemy_hp else GOLD)
		_text("确认后出发行军，到达才交战；物资返城后入库。" if deployment.command.type=="march" else "确认后立即进入战斗，返回不产生战损。", Vector2(929, 751), 16, MUTED)
		return
	var entries = _reserve_entries()
	var pages = maxi(1,ceili(entries.size()/6.0))
	reserve_page = mini(reserve_page,pages-1)
	_button("reserveClass",catalog.classNames.get(reserve_class,"全部兵种"),Rect2(925,264,155,35))
	_button("reserveTier","全部阶级" if reserve_tier==0 else "阶级 %d"%reserve_tier,Rect2(1090,264,132,35))
	_button("reserveFilter",{"owned":"有待命","all":"全部型号","damaged":"有待修"}[reserve_filter],Rect2(1232,264,148,35))
	_button("reserveSort","数量 ↓" if reserve_sort else "阶级 ↑",Rect2(1390,264,152,35))
	for i in range(mini(6,entries.size()-reserve_page*6)):
		var u=entries[reserve_page*6+i]
		var p=Vector2(925+(i%3)*207,313+int(i/3.0)*102)
		_panel(Rect2(p,Vector2(195,92)),Color("253a2d") if compare_unit==u.unitId else Color("192322"),GOLD if compare_unit==u.unitId else LINE)
		_image(u.unitId,Rect2(p+Vector2(3,1),Vector2(104,52)))
		_text("%d"%s.available[u.unitId],p+Vector2(128,35),23,GOLD)
		_text(u.name,p+Vector2(9,68),15)
		_text("待修 %d"%s.damaged[u.unitId],p+Vector2(9,87),13,MUTED)
		_hit("selectReserve",Rect2(p,Vector2(195,92)),u.unitId)
	_button("reservePrev","上一页",Rect2(1285,217,108,38),null,false,reserve_page>0)
	_button("reserveNext","%d/%d 下一页"%[reserve_page+1,pages],Rect2(1400,217,144,38),null,false,pages>1)
	_draw_replacement(Rect2(925,531,617,207))
	for i in range(s.presets.size()):
		_button("presetLoad:"+str(i),s.presets[i].name.substr(0,6),Rect2(925+i*122,750,114,34),i)
	var total=0
	var occupied=0
	for slot in draft:
		if slot!=null:
			total+=slot.count
			occupied+=1
	if not deploying or deployment.command.type!="march":
		_text("已编 %d 辆 · 空缺 %d 格 · 编入不另扣库存"%[total,6-occupied],Vector2(929,818),14,MUTED)
	if not deploying: _button("nav:presets","预设管理",Rect2(1390,785,154,29),"presets")
	elif deployment.command.type=="march":
		var load=0
		for slot in draft:
			if slot!=null: load+=slot.count*info.unitStats[slot.unitId].load
		_button("departurePlan","出征 %d 辆 · 空位 %d · 运力 %s / 行动计划"%[total,6-occupied,_amount(load)],Rect2(925,784,618,36))

func _affordable(cost):
	for id in cost:
		if s.wallet.get(id, 0) < cost[id]:
			return false
	return true

func _core_texture(id):
	return id if id.ends_with("7") else "core_" + id.trim_suffix("_core6")

func _core_icon(id, rect: Rect2):
	var advanced = id.ends_with("7")
	_image(_core_texture(id), rect)
	var badge = Rect2(rect.position + Vector2(rect.size.x - 25, rect.size.y - 16), Vector2(26, 16))
	draw_rect(badge, Color("393321") if advanced else Color("173329"))
	draw_rect(badge, GOLD if advanced else GREEN, false, 1)
	_small("VII" if advanced else "VI", badge.position + Vector2(3, 12), 12, GOLD if advanced else GREEN)

func _item_icon(id, rect: Rect2):
	if "_core" in id:
		_core_icon(id, rect)
	elif id in RES:
		_icon(RES.find(id), rect)
	else:
		_image(id, rect)

func _inventory_entries():
	var entries: Array = []
	for item in info.inventory:
		if inventory_category != "all" and item.category != inventory_category:
			continue
		if inventory_category in ["cores", "vehicles"] and inventory_class != "all" and item.get("classId", "") != inventory_class:
			continue
		if inventory_owned and item.quantity + item.get("reserved", 0) + item.get("incoming", 0) + item.get("producing", 0) <= 0:
			continue
		entries.append(item)
	return entries

func _draw_inventory():
	_title("资源一览", "DEPOT  /  MATERIALS · CORES · VEHICLES · COMMAND")
	_button("nav:attributes","属性 / 战力一览",Rect2(1270,119,290,43),"attributes")
	var categories = [["all", "全部"], ["materials", "矿产 / 金币"], ["cores", "改装核心"], ["vehicles", "战车库存"], ["items", "指挥官物品"]]
	for i in range(categories.size()):
		_button("inventoryCategory:" + categories[i][0], categories[i][1], Rect2(40 + i * 250, 201, 233, 43), categories[i][0], inventory_category == categories[i][0])
	_button("inventoryOwned", "仅显示持有" if inventory_owned else "显示零库存", Rect2(1300, 201, 260, 43), null, inventory_owned)
	if inventory_category in ["cores", "vehicles"]:
		var classes = ["all"] + CLASSES
		for i in range(classes.size()):
			_button("inventoryClass:" + classes[i], "全部车系" if i == 0 else catalog.classNames[classes[i]], Rect2(40 + i * 177, 258, 161, 32), classes[i], inventory_class == classes[i])
	else:
		_text("可用库存不含已投入订单的材料；战车总量包含待命、出征、待修与改装中的原车。", Vector2(42, 282), 15, MUTED)
	var entries = _inventory_entries()
	var pages = maxi(1, int(ceil(entries.size() / 12.0)))
	inventory_page = mini(inventory_page, pages - 1)
	for i in range(mini(12, entries.size() - inventory_page * 12)):
		var item = entries[inventory_page * 12 + i]
		var pos = Vector2(40 + (i % 4) * 386, 308 + int(i / 4.0) * 150)
		var color = GOLD if item.quantity > 0 else MUTED
		_panel(Rect2(pos, Vector2(362, 134)), Color("172321"), GOLD.darkened(0.65) if item.category == "cores" and item.tier == 7 else LINE)
		_item_icon(item.icon, Rect2(pos + Vector2(12, 17), Vector2(88, 72)))
		_text(item.name, pos + Vector2(113, 32), 18, TEXT, true)
		_small(_amount(item.quantity), pos + Vector2(113, 62), 26, color)
		if item.category == "vehicles":
			_text("待命 %d · 出征 %d · 待修 %d" % [item.available, item.marching, item.damaged], pos + Vector2(15, 98), 14, MUTED)
			_text("维修 %d · 改装 %d · 待产 %d" % [item.repairing, item.refitting, item.producing], pos + Vector2(15, 121), 14, MUTED)
		elif item.category == "materials":
			_text("订单占用 %s · 运输中 %s" % [_amount(item.reserved), _amount(item.incoming)], pos + Vector2(15, 101), 14, MUTED)
			_text("可用金币" if item.id == "gold" else "自产 %s / 时 · 容量 %s" % [_amount(info.rates[item.id]), _amount(info.capacity)], pos + Vector2(15, 123), 13, GOLD)
		elif item.category == "cores":
			_text("VI 阶改装 / 制造材料" if item.tier == 6 else "VII 阶精密制造材料", pos + Vector2(15, 101), 14, GOLD)
			_text("订单占用 %s · 点击查看来源" % _amount(item.reserved), pos + Vector2(15, 123), 13, MUTED)
		else:
			_text(item.description, pos + Vector2(15, 108), 14, MUTED)
		_hit("inventoryItem:" + item.id, Rect2(pos, Vector2(362, 134)), item.id)
	if entries.is_empty():
		_text("当前筛选下没有物品，可切换分类或显示零库存。", Vector2(492, 480), 23, MUTED)
	_text("共 %d 项 · K千 / M百万 / G十亿 / T万亿 · 点击查看精确值" % entries.size(), Vector2(42, 796), 16, MUTED)
	_button("inventoryPrev", "上一页", Rect2(1122, 771, 130, 43), null, false, inventory_page > 0)
	_text("%d / %d" % [inventory_page + 1, pages], Vector2(1290, 799), 19, GOLD)
	_button("inventoryNext", "下一页", Rect2(1405, 771, 155, 43), null, false, inventory_page < pages - 1)

func _inventory_details(id):
	for item in info.inventory:
		if item.id != id:
			continue
		var lines: Array[String] = [item.name, "库存数量：" + _amount(item.quantity) + "（精确值 " + QuantityFormat.exact(item.quantity) + "）", ""]
		if item.category == "vehicles":
			lines.append("待命 %d / 出征 %d / 待修 %d / 维修中 %d / 改装占用 %d" % [item.available, item.marching, item.damaged, item.repairing, item.refitting])
			lines.append("待产 %d（尚未完成，不计入现有总量）；累计永久损失 %d（不计入现有总量）。" % [item.producing, item.destroyed])
			lines.append("前往工厂制造或改装，前往维修车间修复战损。编队只是预设，不重复扣除待命库存。")
		elif item.category == "cores":
			lines.append("可用 %d / 已投入订单 %d。取消未完成订单时，核心按剩余数量退回。" % [item.quantity, item.reserved])
			for d in catalog.dungeons:
				for drop in d.drops:
					if drop.id==id: lines.append("主线 %02d %s：首通 %d，重复 %d—%d（等概率整数）。"%[d.index+1,d.name,drop.first,drop.min,drop.max])
			lines.append("用途：制造或改装对应车系的 %d 阶战车，每辆 1 个。VI 与 VII 阶核心不能通用。" % item.tier)
		elif item.category == "materials":
			lines.append("可用 %d / 订单占用 %d / 运输中 %d。" % [item.quantity, item.reserved, item.incoming])
			lines.append("订单占用已从钱包扣除；运输中物资回城才可使用。两者不重复计入可用库存。")
			if item.id != "gold":
				lines.append("每小时自产 %d，仓储上限 %d。奖励可超过自产仓储上限；满仓时暂停自产。" % [info.rates[item.id], info.capacity])
				lines.append("资源统筹 +%.1f%% / 本资源专精 +%.1f%%，两项相加；仓储科技 +%.1f%%。"%[info.researchQuotes.resourceOutput.effectCurrent,info.researchQuotes[item.id+"Output"].effectCurrent,info.researchQuotes.storage.effectCurrent])
				lines.append("空仓至满仓约 %.1f 小时；1—120级统一增长曲线，详情见图书馆。"%(float(info.capacity)/maxf(1,info.rates[item.id])))
		else:
			lines.append(item.description + "，详情见指挥官页面。")
		_details("资源详情 / " + item.name, "\n".join(lines))
		return

func _settlement_rewards():
	var rewards: Array = []
	if report.mode == "training":
		return rewards
	var wallet = report.get("transport",{}).get("cargo",report.rewards) if report.mode=="world" else report.rewards
	for id in RES:
		if wallet.get(id, 0) > 0:
			rewards.append({"name": catalog.resourceNames[id], "icon": id, "count": wallet[id], "cargo": report.mode == "world"})
	for id in report.get("coreRewards", {}):
		if report.coreRewards[id] > 0:
			rewards.append({"name": catalog.coreNames[id], "icon": id, "count": report.coreRewards[id], "cargo": false})
	var growth = report.get("growth", {})
	for entry in [["xp", "经验"], ["prestige", "声望"], ["books", "统率书"], ["skillPoints", "技能点"]]:
		if growth.get(entry[0], 0) > 0:
			rewards.append({"name": entry[1], "icon": "growth:"+entry[0], "count": growth[entry[0]], "cargo": false})
	return rewards

func _cargo_label():
	return report.get("transport", {}).get("label", "历史战时装运记录 · 旧档无入库凭据")

func _draw_settlement():
	var summary = report.summary
	_cover(_battle_environment(), Rect2(0, 0, 1600, 900), Color(0.22, 0.26, 0.23))
	_panel(Rect2(25, 22, 1550, 95), Color("16231e"), GOLD.darkened(0.35))
	_text(("演习胜利" if report.mode == "training" else "作战胜利") if report.winner == 0 else ("演习失利" if report.mode == "training" else "行动受挫"), Vector2(49, 78), 37, GOLD if report.winner == 0 else RED, true)
	_fit_text(report.title, Vector2(328, 66), 826, 28, TEXT, true)
	var outcome = "第 %d 回合结束 · %s先手，超时判负" % [report.rounds,"我方" if report.tactics.firstSide==0 else "敌方"] if report.get("endReason","")=="round-limit" else "战后结算  /  %d 回合" % report.rounds
	_text(outcome + " · " + ("演习记录 · 未扣兵" if report.mode == "training" else "已自动结算"), Vector2(330, 95), 15, MUTED)
	_button("nav:inventory", "资源一览", Rect2(1370, 43, 179, 47), "inventory")
	_button("battleField", "查看战场", Rect2(1180,43,176,47))
	_text("本次所得" if report.mode != "training" else "演习不发放资源或成长奖励", Vector2(42, 150), 19, GOLD, true)
	if report.mode == "world":
		_text(_cargo_label(), Vector2(325, 150), 15, MUTED)
	var rewards = _settlement_rewards()
	var pages = maxi(1, int(ceil(rewards.size() / 10.0)))
	settlement_reward_page = mini(settlement_reward_page, pages - 1)
	if pages > 1:
		_button("rewardPrev", "←", Rect2(1286, 127, 56, 30), null, false, settlement_reward_page > 0)
		_text("%d / %d" % [settlement_reward_page + 1, pages], Vector2(1370, 150), 16, GOLD)
		_button("rewardNext", "→", Rect2(1473, 127, 70, 30), null, false, settlement_reward_page < pages - 1)
	for i in range(mini(10, rewards.size() - settlement_reward_page * 10)):
		var reward = rewards[settlement_reward_page * 10 + i]
		var p = Vector2(40 + (i % 5) * 308, 167 + int(i / 5.0) * 71)
		_panel(Rect2(p, Vector2(288, 61)), Color("192721"), LINE)
		_reward_icon(reward.icon, Rect2(p + Vector2(8, 6), Vector2(47, 47)))
		_fit_text(reward.name, p + Vector2(63, 24), 213, 16, TEXT)
		_small("+" + _amount(reward.count), p + Vector2(63, 51), 23, GOLD)
		_fit_text(("已入库" if report.get("transport", {}).get("status") == "returned" else "装运中") if reward.cargo else "已结算", p + Vector2(222, 49),58,14,MUTED)
		_hit("rewardInfo:"+str(i),Rect2(p,Vector2(288,61)),reward)
	if rewards.is_empty():
		_panel(Rect2(40, 167, 1520, 132), Color("131e1b"), LINE)
		_text("本场没有奖励。" if report.mode != "training" else "仅推演战术，实际部队与库存保持不变。", Vector2(70, 238), 23, MUTED)
	for side in range(2):
		var team = summary.teams[side]
		var p = Vector2(40 + side * 775, 321)
		_panel(Rect2(p, Vector2(745, 381)), Color("12221c") if side == 0 else Color("251c18"), GREEN.darkened(0.4) if side == 0 else RED.darkened(0.4))
		_text("我方作战统计" if side == 0 else "敌方作战统计", p + Vector2(20, 34), 24, GREEN if side == 0 else RED, true)
		_text("出战 %d   生还 %d   损失 %d" % [team.sent, team.survived, team.lost], p + Vector2(21, 66), 19, TEXT)
		_text("有效伤害  " + _amount(team.damage), p + Vector2(21, 99), 26, GOLD, true)
		var columns = [327, 407, 484, 586]
		_text("阵位 / 战车", p + Vector2(20, 132), 14, MUTED)
		for i in range(4):
			_text(["出战", "生还", "损失", "有效伤害"][i], p + Vector2(columns[i], 132), 14, MUTED)
		for i in range(team.rows.size()):
			var row = team.rows[i]
			var y = 155 + i * 31
			_small(str(int(row.slot)), p + Vector2(20, y + 15), 15, GOLD)
			_image(row.unitId, Rect2(p + Vector2(42, y - 7), Vector2(64, 30)))
			_text(row.name, p + Vector2(111, y + 15), 15, TEXT)
			var values = [row.sent, row.survived, row.lost, row.damage]
			for col in range(4):
				_small(_amount(values[col]) if col==3 else str(int(values[col])), p + Vector2(columns[col], y + 15), 17, RED if col == 2 and row.lost > 0 else GOLD if col == 3 else TEXT)
		_fit_text("暴击 %d · 未命中 %d · 溢出伤害 %s · 精确值见详细战报" % [team.critical, team.miss, _amount(maxi(0, team.nominal - team.damage))], p + Vector2(21, 366),701,15,MUTED)
	_panel(Rect2(40, 717, 1520, 78), Color("16201d"), LINE)
	_text("演习损失 %d 辆 · 实际扣除 0 辆" % summary.teams[0].lost if report.mode == "training" else "我方损失 %d 辆  ·  可维修 %d 辆  ·  永久损失 %d 辆" % [summary.teams[0].lost, summary.repairable, summary.destroyed], Vector2(61, 748), 22, GOLD, true)
	var hints=summary.get("feedback",[])
	_fit_text(hints[0] if not hints.is_empty() else "历史回放不会再次发奖。",Vector2(62,779),763,17,MUTED)
	_fit_text("当前可修 %d 辆 · %s"%[info.repairAll.count,_repair_material_text()] if info.repairAll.count>0 else "当前暂无待修车辆",Vector2(850,786),690,15,GOLD)
	_button("battleAdvice","战术建议",Rect2(1210,731,142,42))
	_button("battleAdvanced","高级详情",Rect2(1370,731,171,42))
	var next=_next_battle_target()
	var actions=[["battleDetails","详细战报",null],["battleReplay","回放",null],["nav:army","补兵 / 编队","army"],["nav:repair","维修车间","repair"],["repairAll","全部修复",null],["rematch","再次挑战",null],["nav:campaign","返回世界" if report.mode=="world" else "返回战役","world" if report.mode=="world" else "campaign"],["battleNext","下一关 · 备战",next] if not next.is_empty() else ["nav:objectives","成长目标","objectives"]]
	for i in range(actions.size()): _button(actions[i][0],actions[i][1],Rect2(40+i*192,818,176,49),actions[i][2],i==7,_repair_all_ready() if actions[i][0]=="repairAll" else not _command_pending() if actions[i][0] in ["rematch","battleNext"] else true)

func _next_battle_target():
	if report.get("winner",1)!=0 or report.get("mode","") in ["training","world"]: return {}
	var target=report.get("target",{})
	if target.get("type","")=="battle":
		var index=int(target.stage)+1
		if index<catalog.stages.size() and info.stageStatus[index].unlocked: return {"type":"battle","stage":index}
	elif target.get("type","")=="dungeon":
		for i in range(catalog.dungeons.size()-1):
			if catalog.dungeons[i].id==target.dungeonId and info.dungeonStatus[i+1].block=="": return {"type":"dungeon","dungeonId":catalog.dungeons[i+1].id}
	return {}

func _reward_icon(id,rect):
	if not id.begins_with("growth:"):
		_item_icon(id,rect)
		return
	var kind=id.trim_prefix("growth:")
	var color={"xp":GREEN,"prestige":GOLD,"books":Color("a4bdc7"),"skillPoints":Color("c7a4d5")}[kind]
	var p=rect.position
	var scale=rect.size.x/48.0
	draw_rect(rect.grow(-3*scale),Color("101a19"))
	draw_rect(rect.grow(-3*scale),color.darkened(0.4),false,1.0)
	if kind=="books":
		for x in [10,25]:
			draw_rect(Rect2(p+Vector2(x,12)*scale,Vector2(13,25)*scale),color.darkened(0.3))
			for y in [18,23,28]: draw_line(p+Vector2(x+3,y)*scale,p+Vector2(x+10,y)*scale,color,1.5)
	elif kind=="xp":
		for y in [17,26,35]: draw_polyline(PackedVector2Array([p+Vector2(12,y)*scale,p+Vector2(24,y-6)*scale,p+Vector2(36,y)*scale]),color,3,true)
	else:
		var points=PackedVector2Array()
		for i in range(10): points.append(rect.get_center()+Vector2.from_angle(-PI/2+i*PI/5)*(16 if i%2==0 else 7)*scale)
		draw_colored_polygon(points,color)
		if kind=="skillPoints": draw_circle(rect.get_center(),4*scale,PANEL)

func _effective_time(ms):
	return maxf(0, ms - info.vip.freeMinutes * 60000)

func _eta(ms):
	return "立即完成" if ms <= 0 else _time(ms)

func _tech_rect(node):
	return Rect2(52 + node.col * 340, 296 + node.row * 150, 282, 105)

func _draw_research():
	_title("科研技术树", "RESEARCH BUREAU  /  ECONOMY · INDUSTRY · LOGISTICS · COMBAT")
	_text("科研中心 Lv.%02d" % int(s.buildings.lab), Vector2(1340, 148), 19, GOLD)
	for i in range(catalog.researchBranches.size()):
		var branch = catalog.researchBranches[i]
		_button("researchBranch:" + branch.id, branch.name, Rect2(40 + i * 387, 199, 359, 48), branch.id, branch.id == research_branch)
	_panel(Rect2(40, 268, 1054, 480), Color("101a1b"), LINE)
	var nodes = {}
	for node in catalog.researchTree:
		nodes[node.id] = node
	# Connections are drawn behind nodes; arrowheads show progression direction.
	for node in catalog.researchTree:
		if node.branch != research_branch:
			continue
		for pre in info.researchQuotes[node.id].prerequisites:
			var parent = nodes[pre.id]
			var a = _tech_rect(parent).get_center() + Vector2(142, 0)
			var b = _tech_rect(node).get_center() - Vector2(142, 0)
			var tint = GREEN.darkened(0.4) if pre.current >= pre.level else LINE
			var mid = (a.x + b.x) * 0.5
			if parent.col == node.col:
				a = _tech_rect(parent).get_center() + Vector2(110, 52)
				b = _tech_rect(node).get_center() + Vector2(110, -52)
				draw_line(a, b, tint, 2, true)
			else:
				draw_polyline(PackedVector2Array([a, Vector2(mid, a.y), Vector2(mid, b.y), b]), tint, 2, true)
				draw_line(b, b + Vector2(-7, -5), tint, 2, true)
				draw_line(b, b + Vector2(-7, 5), tint, 2, true)
	for node in catalog.researchTree:
		if node.branch != research_branch:
			continue
		var rect = _tech_rect(node)
		var q = info.researchQuotes[node.id]
		var level = int(s.tech[node.id])
		var active = node.id == selected_tech
		var tint = GREEN if q.block == "" else MUTED
		_panel(rect, Color("343a2b") if active else Color("192625"), GOLD if active else LINE)
		_text(node.name, rect.position + Vector2(16, 30), 21, TEXT, true)
		_small("%02d / 120" % level, rect.position + Vector2(185, 29), 16, GOLD)
		_text(node.effect + " %.1f%%" % q.effectCurrent, rect.position + Vector2(16, 58), 14, MUTED)
		_bar(Rect2(rect.position + Vector2(16, 75), Vector2(133, 4)), level / float(catalog.MAX_LEVEL), GOLD)
		_text("已满级" if level == int(catalog.MAX_LEVEL) else "研究中 / 已排队" if q.duplicate else "可研究" if q.block == "" else "前置未满足", rect.position + Vector2(157, 89), 13, GOLD if q.duplicate else tint)
		_hit("techSelect:" + node.id, rect, node.id)
	var node = nodes[selected_tech]
	var q = info.researchQuotes[selected_tech]
	var level = int(s.tech[selected_tech])
	_panel(Rect2(1123, 268, 437, 480), Color("14201e"), GOLD.darkened(0.6))
	_text(node.name, Vector2(1146, 309), 28, TEXT, true)
	_text("Lv.%02d → %02d / 120" % [level, mini(int(catalog.MAX_LEVEL),level + 1)], Vector2(1147, 340), 19, GOLD)
	_text(node.effect, Vector2(1147, 373), 17, MUTED)
	_text("%.1f%% → %.1f%%" % [q.effectCurrent, q.effectNext], Vector2(1147, 403), 25, GOLD)
	_text("科研中心 %d 级 · 当前 %d" % [q.lab,s.buildings.lab], Vector2(1147, 439), 16, GREEN if s.buildings.lab >= q.lab else RED)
	if q.prerequisites.is_empty():
		_text("基础节点 · 无前置科技", Vector2(1147, 471), 16, GREEN)
	for i in range(q.prerequisites.size()):
		var pre = q.prerequisites[i]
		_text("%s %d 级 · 当前 %d" % [catalog.techNames[pre.id],pre.level,pre.current], Vector2(1147, 471 + i * 29), 16, GREEN if pre.current >= pre.level else RED)
		_hit("techSelect:" + pre.id, Rect2(1143,450+i*29,393,28),pre.id)
	if level>=int(catalog.MAX_LEVEL):
		_text("科技已满级 · 当前效果持续生效",Vector2(1147,557),19,GOLD)
		_text("可前往编队查看实际属性与战力。",Vector2(1147,601),17,MUTED)
	else:
		_cost(q.booked.unitCost if q.booked != null else q.unitCost, Vector2(1146, 541))
		_text("预计完成  " + _eta(q.booked.remainingMs if q.booked != null else q.waitMs + q.duration), Vector2(1147, 578), 21, TEXT, true)
		_text("原时长 " + _time(q.booked.rawRemainingMs if q.booked != null else q.rawDuration) + " · VIP 免 " + str(int(info.vip.freeMinutes)) + " 分钟", Vector2(1147, 604), 15, MUTED)
		_text("等待 " + _time(q.booked.waitMs if q.booked != null else q.waitMs) + " · 效果从完成时生效", Vector2(1147, 632), 15, MUTED)
	_button("research:" + selected_tech, "已在队列中" if q.duplicate else "已达 120 级" if level>=int(catalog.MAX_LEVEL) else "前置条件未满足" if q.block != "" else "队列已满" if info.queues.research.full else "立即研究" if q.duration == 0 and q.waitMs == 0 else "加入研究计划", Rect2(1145, 671, 393, 49), selected_tech, true, not info.queues.research.full and not q.duplicate and q.block == "" and _affordable(q.unitCost) and not _command_pending())
	_hit("nav:lab",Rect2(1144,418,395,31),"base")
	_text("连线表示前置依赖；科技等级越高，所需前置等级也会提高。", Vector2(42, 782), 17, MUTED)
	_text("机动推进每级额外 +3 先手；精密弹道每级额外 +4 二次开火。出征后保留属性快照。", Vector2(42, 811), 15, MUTED)
	_button("nav:queues", "研究队列  %d 工作 / %d 等待 →" % [info.queues.research.active,info.queues.research.waiting], Rect2(1123, 771, 437, 47), "queues")

func _draw_campaign():
	if campaign_mode == "dungeon":
		_draw_dungeons()
		return
	var chapter=int(selected_stage/16)
	_title("钢铁远征 · "+catalog.chapters[chapter].name, "CAMPAIGN / SEVEN CHAPTERS")
	_text("战役进度  %d / 112" % s.cleared.size(), Vector2(1300, 148), 20, GOLD)
	for c in range(7):
		_button("chapter:"+str(c),"%d  %s"%[c+1,catalog.chapters[c].name],Rect2(40+c*218,198,205,39),c,c==chapter)
	for n in range(16):
		var i=chapter*16+n
		var p = Vector2(40 + (n % 4) * 214, 253 + int(n / 4.0) * 130)
		var cleared = info.stageStatus[i].cleared
		var unlocked = info.stageStatus[i].unlocked
		_panel(Rect2(p, Vector2(202, 117)), Color("343a2b") if selected_stage == i else Color("172222"), GOLD if selected_stage == i else LINE)
		_small("%d–%02d" % [chapter+1,n+1], p + Vector2(14, 31), 23, GOLD if unlocked else MUTED)
		_text("已占领" if cleared else "可挑战" if unlocked else "未解锁",p+Vector2(126,29),13,GREEN if cleared else MUTED)
		_text(catalog.stageNames[i].split(" · ")[-1], p + Vector2(14, 66), 20, TEXT if unlocked else MUTED, true)
		var f=catalog.stages[i].formation
		var lo=7
		var hi=1
		var troops=0
		for st in f:
			if st!=null:
				lo=mini(lo,catalog.units[st.unitId].tier)
				hi=maxi(hi,catalog.units[st.unitId].tier)
				troops+=st.count
		_text("%d—%d 阶 · %d 辆"%[lo,hi,troops],p+Vector2(14,97),14,MUTED)
		_hit("stage:" + str(i), Rect2(p, Vector2(202, 117)), i)
	_panel(Rect2(907, 253, 653, 550), Color("111b1c"), LINE)
	var stage = catalog.stages[selected_stage]
	_text(stage.name, Vector2(932, 294), 29, TEXT, true)
	_text(stage.hint.substr(0,29), Vector2(932, 329), 16, MUTED)
	_text(stage.hint.substr(29), Vector2(932, 354), 16, MUTED)
	_text("守军部署 · 战力 %d"%_formation_power(stage.formation,false), Vector2(932, 387), 18, GOLD)
	_mini_formation(stage.formation, Vector2(928, 403), Vector2(190, 88))
	var cleared=info.stageStatus[selected_stage].cleared
	var rewards=stage.repeatReward if cleared else stage.reward
	var growth=stage.repeatGrowth if cleared else stage.growth
	_text(("重复挑战" if cleared else "首次占领")+" · 统率书 +%d / 声望 +%d"%[growth.books,growth.prestige],Vector2(932,618),17,GOLD)
	_cost({"iron":rewards.iron,"oil":rewards.oil,"lead":rewards.lead},Vector2(929,660))
	_cost({"titanium":rewards.get("titanium",0),"crystal":rewards.crystal,"gold":rewards.gold},Vector2(929,701))
	_button("training", "战术演习 · 无战损", Rect2(929, 749, 270, 43), null, false, not _command_pending())
	var unlocked = info.stageStatus[selected_stage].unlocked
	_button("attack", "发起进攻", Rect2(1215, 749, 319, 43), null, true, unlocked and not _command_pending())
	_button("campaignMode:dungeon", "核心副本 →", Rect2(40, 788, 230, 36), "dungeon")
	_text("七章架空行动 · 演习无掉落；正式胜利推进关卡。",Vector2(300,814),15,MUTED)

func _draw_dungeons():
	_title("核心行动", "CORE OPERATIONS")
	_button("campaignMode:stage", "← 经典战役", Rect2(1331,119,231,44), "stage")
	selected_dungeon = clampi(selected_dungeon, 0, catalog.dungeons.size()-1)
	var chapter=int(selected_dungeon/16)
	_text("五章 · 每章16关   |   已突破 %d / %d   |   首通固定，重复随机"%[s.arsenal.cleared.size(),catalog.dungeons.size()],Vector2(43,179),17,GOLD)
	for c in range(catalog.coreChapters.size()):
		var cleared = 0
		for i in range(c*16,c*16+16):
			if info.dungeonStatus[i].cleared: cleared+=1
		_button("coreChapter:"+str(c),"%d  %s  %d/16"%[c+1,catalog.coreChapters[c],cleared],Rect2(40+c*306,198,294,39),c,c==chapter)
	for local in range(16):
		var i = chapter*16+local
		var d=catalog.dungeons[i]
		var status=info.dungeonStatus[i]
		var p=Vector2(40+(local%4)*214,253+int(local/4.0)*130)
		_panel(Rect2(p,Vector2(202,117)),Color("343a2b") if i==selected_dungeon else Color("172222"),GOLD if i==selected_dungeon else LINE)
		_small("%d-%02d"%[chapter+1,local+1],p+Vector2(12,27),20,GOLD)
		_core_icon(d.classId+"_core7",Rect2(p+Vector2(145,6),Vector2(45,45)))
		_text(catalog.classNames[d.classId],p+Vector2(12,59),20,TEXT,true)
		_text("VI %d—%d / VII %d—%d"%[d.drops[0].min,d.drops[0].max,d.drops[1].min,d.drops[1].max],p+Vector2(12,84),13,GOLD)
		_text(("已突破" if status.cleared else "可挑战" if status.block=="" else "未开放")+" · 工厂%d级"%d.factoryLevel,p+Vector2(12,106),13,GREEN if status.cleared else MUTED)
		_hit("dungeon:"+str(i),Rect2(p,Vector2(202,117)),i)
	var d=catalog.dungeons[selected_dungeon]
	var status=info.dungeonStatus[selected_dungeon]
	_panel(Rect2(907,253,653,550),Color("111b1c"),LINE)
	_text(d.name,Vector2(930,286),24,TEXT,true)
	var legacy_clear=d.id in s.arsenal.cleared and maxf(s.buildings.factory,s.industry.factory2)<d.factoryLevel
	_text(catalog.classNames[d.classId]+"补给 · "+("旧通关可重打（新关需工厂 %d 级）" if legacy_clear else "制造工厂 %d 级")%d.factoryLevel,Vector2(931,313),17,GOLD)
	_text("守军战力 %s · 攻防 / 弹道 / 装甲 / 机动科技 %d级"%[_amount(d.power),d.guardTech],Vector2(931,338),16,TEXT)
	_mini_formation(d.formation,Vector2(928,350),Vector2(190,68))
	_text("本关只产出"+catalog.classNames[d.classId]+"的两种核心",Vector2(931,521),17,GOLD)
	for i in range(2):
		var drop=d.drops[i]
		var y=533+i*58
		_core_icon(drop.id,Rect2(934,y,49,49))
		_text(catalog.coreNames[drop.id],Vector2(998,y+21),18,TEXT,true)
		_text("首通 %d · 重复 %d—%d · 持有 %s"%[drop.first,drop.min,drop.max,_amount(s.arsenal.cores[drop.id])],Vector2(998,y+45),16,GOLD)
	_text(("本次重复" if status.cleared else "本次首通")+" · 经验 %s / 声望 %s / 统率书 %d"%[_amount(d.growth.xp),_amount(d.growth.prestige),d.growth.books],Vector2(932,677),16,GREEN)
	_text("两种数量独立、区间内等概率；失败 / 演习无掉落。",Vector2(932,703),15,MUTED)
	_text(status.block if status.block!="" else "建议先演习评估战损；重复收益需扣除补兵成本。",Vector2(932,730),15,RED if status.block!="" else GOLD)
	_button("dungeonTraining","战术演习 · 无掉落",Rect2(929,749,270,43),null,false,not _command_pending())
	_button("dungeonAttack","发起核心行动",Rect2(1215,749,319,43),null,true,status.block=="" and not _command_pending())
	_button("coreRoute","章节曲线 / 补给预算",Rect2(40,788,247,36))
	_text("依次突破 · 跨章承接上一章末关 · 旧通关保持开放",Vector2(306,814),15,MUTED)

func _core_route_details():
	var lines: Array[String] = ["五章各16关。每四关按坦克、歼击、火炮、火箭循环；产出只属于本关车系。", "首通固定，重复数量独立随机。以下100辆预算只计算VII核心的均值产出，不含首通、失败、前置关、材料与战损补兵，不是次数保证。", ""]
	for c in range(catalog.coreChapters.size()):
		var first=catalog.dungeons[c*16]
		var last=catalog.dungeons[c*16+15]
		lines.append("第%d章 %s：工厂%d—%d级；守军科技%d—%d级。"%[c+1,catalog.coreChapters[c],first.factoryLevel,last.factoryLevel,first.guardTech,last.guardTech])
		for b in range(4):
			var d=catalog.dungeons[c*16+b*4]
			var vi=d.drops[0]
			var vii=d.drops[1]
			lines.append("  %02d—%02d关：VI %d—%d；VII %d—%d。100辆VII核心约%d胜。"%[b*4+1,b*4+4,vi.min,vi.max,vii.min,vii.max,ceili(200.0/(vii.min+vii.max))])
		lines.append("")
	lines.append("旧16关分别映射到前四章前四关；既有节点可重打，新增关卡不赠送通关或补发首通。车辆仍为七阶，每辆VI / VII各消耗对应核心1个；矿产、维修、制造费用沿用当前规则。")
	_details("核心战线 · 难度与产出", "\n".join(lines))

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
	_button("mapResource",catalog.resourceNames.get(map_resource,"敌军据点" if map_resource=="npc" else "全部资源"),Rect2(61,754,156,33))
	_button("mapLevel",["全部等级","Lv.1—20","Lv.21—40","Lv.41—60","Lv.61—80","Lv.81—100","Lv.101—120"][map_level],Rect2(229,754,143,33))
	_button("mapIntel",{"all":"全部情报","known":"已侦察","unknown":"未侦察","guarded":"已知有守军"}[map_intel],Rect2(384,754,182,33))
	_button("expeditionHistory","归队入库记录",Rect2(577,754,183,33))
	_text("◆ 据点   ○ 矿点",Vector2(779,777),16,GOLD)
	_button("mapHome", "我的基地", Rect2(206, 208, 136, 32))
	_button("mapSelected", "当前目标", Rect2(351, 208, 136, 32))
	_button("mapZoomOut", "−", Rect2(500, 208, 45, 32))
	_button("mapZoomIn", "+", Rect2(554, 208, 45, 32))
	_small(("%.1f×  滚轮缩放 / 右键拖动" if _map_matches(_site()) else "%.1f×") % map_zoom, Vector2(615, 230), 14, GOLD)
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
		if not _map_matches(site) and site.id!=selected_site: continue
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
		_small(str(int(site.level)), p + Vector2(10, 4), 14, TEXT)
		if s.intel.has(site.id): draw_circle(p+Vector2(-12,-9),3,GOLD)
		if (map_zoom>=3 or site.id==selected_site) and MAP_RECT.grow(-38).has_point(p): _text(site.name,p+Vector2(-25,26),14,TEXT)
		_hit("site:" + site.id, Rect2(p - Vector2(12, 8), Vector2(24, 16)), site.id)
	for i in range(mini(3,s.presets.size())):
		_button("worldPreset",s.presets[i].name,Rect2(62+i*200,797,186,31),i)
	_button("nav:army","调整下一队编队",Rect2(679,797,311,31),"army")
	var site = _site()
	if not _map_matches(site):
		_button("mapClear","已选目标在筛选外 · 显示全部",Rect2(663,208,331,32),null,true)
	_panel(Rect2(1040, 202, 520, 367), Color("131e1e"), LINE)
	_icon(RES.find(site.resource), Rect2(1056, 217, 83, 83))
	_text(site.name, Vector2(1149, 250), 27, TEXT, true)
	_small("LV.%d  /  [%02d, %02d]" % [site.level, site.x, site.y], Vector2(1151, 280), 17, GOLD)
	var mq = info.marchQuotes[site.id]
	_fit_text("下一队 · 去程 " + _time(mq.outboundMs) + " / 返程 " + _time(mq.returnMs) if mq.load>0 else "下一队尚无可出征兵力",Vector2(1063,316),473,17,GOLD)
	_fit_text("采集 " + _time(mq.gatherMs) + " · 全程约 " + _time(mq.totalMs) if mq.load>0 else "请调整编队，或等待现有远征队归来",Vector2(1063,343),473,16,TEXT)
	var intel = s.intel.get(site.id)
	var guards = 0
	if intel != null:
		for st in intel.guards:
			if st != null:
				guards += int(st.count)
	_text("%s · 守军 %d 辆 · %s 前" % ["情报过期" if s.now-intel.at>=info.worldInterval else "已侦察",guards, _time(s.now - intel.at)] if intel != null else "守军未知 · 建议先侦察", Vector2(1063, 374), 16, TEXT)
	_fit_text(("计划 %s · 运力 %s · %s/时" % [_amount(mq.amount),_amount(mq.load),_amount(mq.gatherRate)] if mq.load>0 else "矿点采速 %s/时 · 配置部队后计算收益"%_amount(mq.gatherRate)) if site.kind=="mine" else "突袭无采集等待，到达后战斗并返航",Vector2(1063,403),473,16,MUTED)
	if site.kind == "mine":
		var supply="作业中暂停补给" if s.marches.any(func(m):return m.targetId==site.id) else "补给 "+_time(site.lastGrowth+info.worldInterval-s.now)
		_text("矿储 %s/%s · %s" % [_amount(site.reserve), _amount(info.mineCaps[site.id]), supply], Vector2(1063, 430), 16, MUTED)
	elif intel != null:
		_text("情报物资 " + _cost_text(intel.wallet), Vector2(1063, 430), 11, MUTED)
	_fit_text("当前远征队的实际进度见下方" if mq.load<=0 else "含往返毛收益 %.1f×自产 · 未扣战损"%mq.tripMultiple if site.kind=="mine" and mq.localRate>0 else "往返计时；新据点保护10%储备",Vector2(1063,557),473,15,GOLD)
	_button("scout", ("重新侦察" if intel!=null else "侦察")+" · %s 水晶"%_amount(mq.scoutCost), Rect2(1062, 445, 259, 37), null, false, s.wallet.crystal>=mq.scoutCost and not _command_pending())
	_button("scoutDetails","守军阵位详情",Rect2(1334,445,200,37))
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
		var status = info.dispatch.expeditions.rows.filter(func(v): return v.id == m.id)[0]
		var phase_ms = status.phaseMs
		var home_ms = status.returnMs
		var target={}
		for v in s.world:
			if v.id==m.targetId: target=v
		_fit_text("%s [%d,%d] · %s"%[target.get("name","远征"),target.get("x",0),target.get("y",0),phase],Vector2(1060,y+26),383,17,GOLD)
		_text("载货 %s/%s · 预计回城 %s" % [_amount(cargo), _amount(m.capacity), _time(home_ms)], Vector2(1060, y + 54), 15, MUTED)
		_text("本段 "+_time(phase_ms)+" · 采速 %s/时"%_amount(m.gatherRate),Vector2(1060,y+80),15,MUTED)
		_button("recall:" + m.id, "召回", Rect2(1454, y + 22, 84, 39), m.id, false, m.phase != "returning")
	_button("marchNext", "远征列表 %d/%d · 下一页" % [march_page + 1, maxi(1, ceili(s.marches.size() / 2.0))], Rect2(1220, 797, 340, 30), null, false, s.marches.size() > 2)

func _draw_commander():
	_title("指挥官档案", "OFFICER DOSSIER  /  HONOR & DUTY")
	_panel(Rect2(40, 205, 460, 560), Color("172220"), LINE)
	_image("emblem", Rect2(154, 220, 232, 190))
	_text(s.nickname, Vector2(76, 439), 34, TEXT, true)
	_text(info.rank + "    Lv." + str(int(info.level)), Vector2(78, 479), 21, GOLD)
	_text("作战经验  %d" % int(s.commander.xp), Vector2(78, 524), 18, MUTED)
	_text("声望 Lv.%d · %d" % [info.prestigeLevel,s.commander.prestige], Vector2(78, 560), 18, MUTED)
	_button("nav:attributes","战力 %s / 属性一览"%_amount(info.power.ceiling),Rect2(75,574,389,29),"attributes")
	var daily_ready = int(floor((s.now + 28800000) / 86400000.0)) > s.lastDaily
	_button("daily", ("每日补给 · 含1技能点" if s.buildings.hq>20 else "领取每日补给") if daily_ready else "今日补给已领取", Rect2(75, 610, 389, 47), null, true, daily_ready and not _command_pending())
	_button("rename", "编辑指挥官名称", Rect2(75, 679, 389, 43))
	_panel(Rect2(530, 205, 1030, 146), Color("172220"), LINE)
	_text("统率能力", Vector2(553, 242), 23, TEXT, true)
	_text("等级 %d   每格 %d 辆   统率书 %d" % [s.commander.leadership, info.leadership, s.commander.books], Vector2(553, 279), 18, MUTED)
	_button("nav:commandTraining", "统率 / 技能 / 购买统率书 →", Rect2(552, 299, 448, 36), "commandTraining", true)
	_text("进攻技能", Vector2(1070, 242), 23, TEXT, true)
	_text("攻击 +%d%%   技能点 %d" % [s.commander.attackSkill * 2, s.commander.skillPoints], Vector2(1070, 279), 18, MUTED)
	_button("skill", "提升攻击 · 1 点", Rect2(1070, 299, 268, 36), null, true, s.commander.skillPoints > 0 and s.commander.attackSkill < int(catalog.MAX_LEVEL) and not _command_pending())
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
	_text("保留最近 100 场 · 列表手动接入新记录", Vector2(1190, 148), 16, MUTED)
	_button("reportType",{"all":"全部类型","stage":"战役","dungeon":"核心副本","world":"世界行动","training":"演习"}[report_type],Rect2(40,197,220,36))
	_button("reportResult",{"all":"全部结果","win":"胜利","loss":"失败"}[report_result],Rect2(278,197,220,36))
	var unseen=0
	for r in s.reports:
		if not report_rows.any(func(v):return v.id==r.id): unseen+=1
	_button("reportRefresh","刷新 · %d 条新战报"%unseen if unseen>0 else "刷新列表",Rect2(1240,197,320,36),null,unseen>0)
	var rows=_filtered_reports()
	if rows.is_empty():
		_image("tank", Rect2(500, 280, 580, 310), Color(0.5, 0.58, 0.48))
		_text("没有符合筛选的战报。", Vector2(570, 653), 23, MUTED)
	for i in range(5):
		var index = report_page * 5 + i
		if index >= rows.size():
			break
		var r = rows[index]
		var p = Vector2(40, 249 + i * 104)
		_panel(Rect2(p, Vector2(1520, 95)), Color("162221"), LINE)
		_text("胜利" if r.winner == 0 else "失利", p + Vector2(18, 48), 23, GREEN if r.winner == 0 else RED, true)
		_text(r.title.substr(0,20), p + Vector2(103, 30), 20, TEXT, true)
		_text(Time.get_datetime_string_from_unix_time(int(r.at/1000)+28800,true).substr(0,16),p+Vector2(103,57),15,MUTED)
		_text({"stage":"战役","dungeon":"核心副本","world":"世界行动","training":"演习 · 实际未扣兵"}[r.mode]+" · %d 回合"%r.rounds,p+Vector2(103,81),14,MUTED)
		var loss=0
		var repair=0
		for v in r.casualties:
			loss+=v.lost
			repair+=v.repairable
		_text("推演损失 %d"%loss if r.mode=="training" else "损失 %d · 待修 %d"%[loss,repair],p+Vector2(435,31),16,GOLD)
		var reward_items = []
		for key in r.get("coreRewards", {}):
			if r.coreRewards[key] > 0: reward_items.append({"id":key,"count":r.coreRewards[key]})
		var shown_rewards = r.get("transport",{}).get("cargo",r.rewards) if r.mode=="world" else r.rewards
		for key in RES:
			if shown_rewards.get(key, 0) > 0: reward_items.append({"id":key,"count":shown_rewards[key]})
		for key in ["xp","books","prestige","skillPoints"]:
			if r.get("growth",{}).get(key,0)>0: reward_items.append({"id":"emblem","count":r.growth[key]})
		for j in range(mini(8, reward_items.size())):
			var at=p+Vector2(650+(j%4)*116,5+int(j/4.0)*40)
			_item_icon(reward_items[j].id, Rect2(at, Vector2(32,32)))
			_text(_amount(reward_items[j].count), at+Vector2(35,24), 16, GOLD)
		if reward_items.is_empty(): _text("无物资奖励",p+Vector2(660,46),16,MUTED)
		if r.mode == "world": _text(r.get("transport", {}).get("label", "历史记录").substr(0,16), p + Vector2(435,68), 14, MUTED)
		_button("reportSummary:" + r.id, "结算 / 全部 %d 项奖励"%reward_items.size(), Rect2(p.x + 1139, p.y + 10, 355, 33), r.id)
		_button("report:" + r.id, "播放原始战斗", Rect2(p.x + 1139, p.y + 51, 355, 33), r.id, true)
	_button("reportsPrev", "上一页", Rect2(1170, 786, 122, 35),null,false,report_page>0)
	_text("%d / %d" % [report_page + 1, maxi(1, ceili(rows.size()/5.0))], Vector2(1318, 811), 19, GOLD)
	_button("reportsNext", "下一页", Rect2(1415, 786, 144, 35),null,false,(report_page+1)*5<rows.size())

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
	_button("settingsAdvanced","返回常用设置" if settings_advanced else "高级 · 导入导出与诊断",Rect2(65,411,685,44),null,settings_advanced)
	if settings_advanced:
		_button("export","导出存档 JSON",Rect2(65,471,209,44))
		_button("import","导入为新档",Rect2(295,471,209,44))
		_button("restore","恢复备份",Rect2(525,471,225,44),null,false,info.get("hasBackup",false))
		_button("savefolder","打开存档目录",Rect2(65,531,329,44))
		_button("nav:vip","VIP / 本机 root 管理",Rect2(414,531,336,44),"vip")
		_text("导入和复制创建独立存档，不覆盖原档。",Vector2(66,618),19,GOLD)
		_text("休整 / VIP / 金币加速规则见操作说明。",Vector2(66,655),18,MUTED)
		_text("仅本机模拟；没有真实充值。",Vector2(66,691),18,MUTED)
	else:
		_button("new","建立新基地",Rect2(65,471,329,44))
		_button("fullscreen","全屏 / 窗口  F11",Rect2(414,471,336,44))
		_button("sound","音效关闭" if muted else "音效开启",Rect2(65,531,209,44))
		_button("volumeDown","−",Rect2(296,531,52,44))
		_text("音量 %d%%"%roundi(audio_volume*100),Vector2(367,560),21,GOLD)
		_button("volumeUp","+",Rect2(526,531,52,44))
		_button("textScale","字号 %d%%"%roundi(ui_scale*100),Rect2(598,531,152,44))
		_button("controls","操作说明与快捷键",Rect2(65,598,329,44))
		_button("nav:library","战地图书馆  F1",Rect2(414,598,336,44),"library")
		_text("窗口自动缩放；可切换标准 / 大字号。",Vector2(66,684),18,MUTED)
		_text("切换存档时会结算该基地的离线进度。",Vector2(66,723),18,GOLD)

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
		_small(timestamp + "  ·  指挥部 %d 级  ·  关卡 %d/112" % [item.get("hq", 1), item.get("cleared", 0)], Vector2(854, y + 46), 12, MUTED)
		if item.get("recoverable", false):
			_small("可恢复", Vector2(1295, y + 24), 13, GOLD)
		_button("load:" + item.id, "当前" if item.id == s.id else "载入", Rect2(1391, y + 9, 125, 38), item.id, item.id == s.id, item.id != s.id and not _command_pending())
	if saves.size() > 7:
		_button("savesPrev", "上一页", Rect2(1190, 749, 140, 29))
		_button("savesNext", "下一页", Rect2(1350, 749, 187, 29))

func open_report(value, summary = {}):
	_stop_battle_audio()
	battle_audio_events.clear()
	report = value
	if not summary.is_empty():
		report.summary = summary
	settlement_visible = true
	settlement_reward_page = 0
	battle_armies = report.initial.duplicate(true)
	battle_index = 0
	battle_time = 0
	battle_clock = 0
	battle_deaths = {}
	battle_aims = {}
	battle_volley = []
	battle_shots = []
	battle_pending_impacts = []
	battle_impact_played = false
	battle_visual_end = 0.0
	battle_craters = []
	battle_interval = 1.05
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
		if pending_hit:
			_apply_hit()
		if battle_time >= battle_interval and battle_index < report.events.size():
			battle_time -= battle_interval
			_play_hit()
			battle_interval = 0.52 if _next_same_action() else 1.05
	if _battle_done():
		battle_clock = _battle_end_time()

func _play_hit():
	last_hit = report.events[battle_index]
	hit_time = battle_clock - battle_time
	pending_hit = true
	battle_volley = []
	# Rocket clips contain an entire salvo, so schedule all six recorded events
	# together with short offsets. Other guns keep their independent 0.52s shots.
	while battle_index < report.events.size():
		var e = report.events[battle_index]
		if not _same_battle_action(e, last_hit):
			break
		if not battle_volley.is_empty() and _volley_class() != "rocket":
			break
		battle_volley.append(e)
		battle_index += 1
	battle_aims["%d:%d" % [last_hit.side, last_hit.from]] = _battle_position(1 - int(last_hit.side), int(last_hit.to)) - Vector2(0, 20)
	_battle_sound(_volley_class(), "fire")
	battle_shots = battle_shots.filter(func(shot): return battle_clock - shot.at < 1.03)
	battle_pending_impacts = []
	battle_impact_played = false
	# Old snapshots with a single simultaneous shot retain their original grouping.
	var staggered = _volley_class()=="rocket" and battle_volley.any(func(e): return e.get("shot",1)>1)
	for i in range(battle_volley.size()):
		var at = hit_time + (ROCKET_LAUNCH_OFFSETS[mini(i,5)] if staggered else 0.0)
		battle_pending_impacts.append({"event":battle_volley[i],"at":at+0.32})
		if staggered: battle_shots.append({"events":[battle_volley[i].duplicate(true)],"at":at})
		battle_visual_end = at + 0.96
	if not staggered: battle_shots.append({"events": battle_volley.duplicate(true), "at": hit_time})

func _same_battle_action(a, b):
	if a.has("action") and b.has("action"):
		return a.action == b.action
	return a.round == b.round and a.side == b.side and a.from == b.from

func _next_same_action():
	return battle_index < report.events.size() and _same_battle_action(report.events[battle_index], last_hit)

func _apply_hit():
	while not battle_pending_impacts.is_empty() and battle_pending_impacts[0].at<=battle_clock+0.000001:
		var impact=battle_pending_impacts.pop_front()
		var e=impact.event
		# rocket_impact.wav is the original cluster-explosion clip, not a single hit.
		if not e.miss and not battle_impact_played:
			_battle_sound(_volley_class(), "impact")
			battle_impact_played=true
		if e.get("ground", false):
			battle_craters.append({"at": impact.at, "side": 1-int(e.side), "slot": int(e.to), "position": _battle_position(1-int(e.side), int(e.to)), "seed": int(e.get("action",0))*7+int(e.to)})
			continue
		for st in battle_armies[1 - int(e.side)]:
			if st.slot == e.to:
				if st.totalHp > 0 and e.hp <= 0:
					var side = 1 - int(e.side)
					var at = impact.at
					battle_deaths["%d:%d" % [side, int(e.to)]] = {"at": at, "side": side, "slot": int(e.to), "unitId": st.unitId, "position": _alive_position(side, int(e.to), at)}
				st.totalHp = e.hp
				st.count = e.remaining
	pending_hit = not battle_pending_impacts.is_empty()


# The ground UVs and stationary world objects share one displacement function.
# Texture motion = negative UV motion times the texture's projected size.
func _ground_displacement(side: int, elapsed: float) -> Vector2:
	return Vector2(-760 * 0.7, 507 * 0.39) * 0.06 * elapsed * (1 if side == 0 else -1)

func _crater_position(crater) -> Vector2:
	return crater.position + _ground_displacement(crater.side, maxf(0, battle_clock-crater.at))

func _draw_battle_craters():
	# Painted immediately after terrain and before wrecks/vehicles/labels.
	for crater in battle_craters:
		var p = _crater_position(crater)
		if not Rect2(35,160,1530,620).has_point(p): continue
		var radius = 23.0 + int(crater.seed)%5
		draw_set_transform(p,0,Vector2(1,0.48))
		var rim = PackedVector2Array()
		for i in range(20):
			rim.append(Vector2.from_angle(i*TAU/20.0)*(radius+3+sin(i*2.71+crater.seed)*3))
		draw_colored_polygon(rim,Color(0.26,0.22,0.15,0.92))
		draw_circle(Vector2.ZERO,radius,Color(0.09,0.085,0.065,0.84))
		draw_arc(Vector2(0,2),radius*0.84,0.15,PI-0.15,24,Color(0.39,0.32,0.21,0.8),3,true)
		draw_circle(Vector2(2,-2),radius*0.55,Color(0.05,0.055,0.045,0.6))
		for i in range(7):
			var chip=Vector2.from_angle(i*2.39+crater.seed)*(radius+6+i%3*4)
			draw_circle(chip,1.5+i%2,Color(0.35,0.29,0.19,0.85))
		draw_set_transform(Vector2.ZERO)

func _alive_position(side: int, slot: int, at: float) -> Vector2:
	var heading = -_ground_displacement(side, 1.0).normalized()
	return _battle_position(side, slot) + heading * (sin(at * 3.4 + slot * 1.7) * 2.2 + sin(at * 17 + slot * 2) * 0.65)

func _unit_position(side: int, slot: int) -> Vector2:
	var death = battle_deaths.get("%d:%d" % [side, slot], {})
	if not death.is_empty():
		return death.position + _ground_displacement(side, maxf(0, battle_clock - death.at))
	return _alive_position(side, slot, battle_clock)

func _battle_end_time() -> float:
	var end = battle_visual_end if not last_hit.is_empty() else 0.0
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
	battle_shots = []
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

func _shot_point(from: Vector2, target: Vector2, launch: Vector2, t: float, indirect: bool, descent_degrees: float = 60.0):
	if indirect:
		# The folded battlefield omits the distant airborne portion. Visible pieces
		# are two straight rays: out of the barrel and steeply down onto the target.
		var outbound = launch.normalized()
		var incoming = Vector2(signf(outbound.x) * cos(deg_to_rad(descent_degrees)), sin(deg_to_rad(descent_degrees)))
		var departure = 190.0
		var approach = 200.0
		var exit_point = from + outbound * departure
		var entry = target - incoming * approach
		if t <= 0.4:
			return from.lerp(exit_point, t / 0.4)
		if t >= 0.6:
			return entry.lerp(target, (t - 0.6) / 0.4)
		# C1-continuous transit, hidden with its entire trail (no visible elbow).
		return exit_point.bezier_interpolate(exit_point + outbound * departure / 6.0, entry - incoming * approach / 6.0, entry, (t - 0.4) / 0.2)
	# Direct-fire geometry is unchanged, including its original camera fold.
	var slope = 115.0 / 305.0
	var crossing = launch
	var rate = crossing.y - crossing.x * slope
	var entry = from + crossing * (-(from.y - _fold_y(from.x)) / rate)
	var exit_point = target - crossing * ((target.y - _fold_y(target.x)) / rate)
	if t < 0.44:
		var part = t / 0.44
		return from.lerp(entry, part)
	if t < 0.56:
		return entry.lerp(exit_point, (t - 0.44) / 0.12)
	return exit_point.lerp(target, (t - 0.56) / 0.44)

func _shot_trail(origin: Vector2, target: Vector2, launch: Vector2, age: float, indirect: bool, descent_degrees: float):
	var t = age / 0.32
	var exit_t = 0.4 if indirect else 0.44
	var entry_t = 0.6 if indirect else 0.56
	if t < 0 or t >= 1 or (t >= exit_t and t <= entry_t):
		return {}
	var tail_t = maxf(0, (age - 0.045) / 0.32)
	if t > entry_t:
		tail_t = maxf(tail_t, entry_t)
	var opacity = 1.0
	if indirect:
		# Fade at the omitted distant segment instead of snapping across the seam.
		opacity = clampf((exit_t - t) / 0.09 if t < exit_t else (t - entry_t) / 0.09, 0, 1)
	return {"head":_shot_point(origin,target,launch,t,indirect,descent_degrees), "tail":_shot_point(origin,target,launch,tail_t,indirect,descent_degrees), "opacity":opacity}

func _fold_y(x):
	return 184.0 + x * (115.0 / 305.0)

func _ground_polygon(points: PackedVector2Array, side, shade = Color.WHITE, depth = 0.0):
	var uv = PackedVector2Array()
	var travel = -_ground_displacement(side, battle_clock) / Vector2(760, 507)
	for p in points:
		uv.append(p / Vector2(760, 507) + travel + Vector2(depth, -depth * 0.55))
	draw_colored_polygon(points, shade.darkened(0.18), uv, textures.get(_battle_environment(), textures.battle_terrain))

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
	if textures.has("battle_edges") and _battle_environment()=="battle_terrain":
		draw_texture_rect(textures.battle_edges, Rect2(0, 80, 1600, 760), false, Color(0.62, 0.68, 0.58))
	_draw_environment_border()

func _fold_edge(x, edge):
	return _fold_y(x) - 9 + edge * 6 + sin(x * 0.041) * 2.4 + sin(x * 0.019 + edge * 1.6) * 1.5

func _effect(cell, r: Rect2, color = Color.WHITE):
	if textures.has("combat_fx"):
		var tex = textures.combat_fx
		var tile = tex.get_size() / 2
		draw_texture_rect_region(tex, r, Rect2(Vector2(cell % 2, int(cell / 2.0)) * tile, tile), color)

func _battle_position(side, slot):
	var column = (slot - 1) % 3
	var base = Vector2(400, 450) if side == 0 else Vector2(710, 330)
	var depth = Vector2(-170, 90) if side == 0 else Vector2(130, -120)
	return base + Vector2(300, 100) * column + (depth if slot > 3 else Vector2.ZERO)

func _battle_width(unit_tier):
	return [110.0, 130.0, 150.0, 171.0, 191.0, 211.0, 232.0][unit_tier - 1]

func _battle_done():
	for death in battle_deaths.values():
		if battle_clock - death.at < 1.65 - 0.000001:
			return false
	return battle_index >= report.get("events", []).size() and not pending_hit and (last_hit.is_empty() or battle_clock >= battle_visual_end - 0.000001)

func _draw_battle_vehicle(st, side):
	var p = _unit_position(side, int(st.slot))
	var alive = st.totalHp > 0
	if not alive and not _wreck_in_view(side,st.slot): return
	var tint = Color.WHITE if side == 0 else Color(1, 0.94, 0.90)
	var pose = _battle_pose(st.unitId, side, int(st.slot))
	if alive:
		draw_set_transform(p,0,Vector2(1,0.28))
		draw_circle(Vector2(0,18),_battle_width(int(st.unitId.right(1)))*0.39,Color(0.02,0.035,0.03,0.3))
		draw_set_transform(Vector2.ZERO)
		if not last_hit.is_empty() and last_hit.side==side and last_hit.from==st.slot:
			draw_arc(p,62,0,TAU,48,GOLD,2,true)
		if battle_volley.any(func(e): return 1-int(e.side)==side and e.to==st.slot):
			draw_arc(p,68,0,TAU,48,RED,2,true)
		if not _battle_done():
			var trail = Vector2(-55, 22) if side == 0 else Vector2(32, -27)
			_effect(2, Rect2(p + trail - Vector2(36, 22), Vector2(95, 53)), Color(0.86, 0.79, 0.61, 0.35))
		_draw_sprite_polygon(battle_sprite_meta[pose.texture], pose.position, pose.pivot, pose.scale.x, tint)
	else:
		_draw_wreck(st, side, p)
	_hit("battleUnit:%d:%d" % [side, st.slot], Rect2(p - Vector2(88, 64), Vector2(176, 118)))

func _draw_battle_label(st, side):
	if st.totalHp<=0: return
	var p=_unit_position(side,int(st.slot))
	var label="%d · ×%d"%[st.slot,st.count]
	var width=maxf(100,font.get_string_size(label,HORIZONTAL_ALIGNMENT_LEFT,-1,17).x+20)
	var rect=Rect2(p+Vector2(-width*0.5,38),Vector2(width,39))
	for tries in range(8):
		if not battle_labels.any(func(v): return v.grow(6).intersects(rect)): break
		rect.position.x+=width+8
	rect.position.x=clampf(rect.position.x,15,1585-width)
	rect.position.y=clampf(rect.position.y,170,791)
	battle_labels.append(rect)
	_panel(rect,Color("142a23") if side==0 else Color("3d241f"),GREEN.darkened(0.3) if side==0 else RED.darkened(0.3))
	_text(label,rect.position+Vector2(8,20),17,TEXT,true)
	var original_hp=1.0
	for original in report.initial[side]:
		if original.slot==st.slot: original_hp=maxf(1,original.totalHp)
	_bar(Rect2(rect.position+Vector2(6,27),Vector2(width-12,5)),st.totalHp/original_hp,GREEN if side==0 else RED)
	_hit("battleUnit:%d:%d"%[side,st.slot],rect)

func _wreck_in_view(side,slot):
	var p=_unit_position(side,slot)
	return Rect2(125,195,1350,555).has_point(p)

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
		if not _wreck_in_view(death.side,death.slot): continue
		var p = _unit_position(death.side, death.slot) - Vector2(0, 6)
		var tier_size = int(death.unitId.right(1))
		var size_px = 115.0 + tier_size * 9
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
		# The impact owns the single destruction label; the explosion stays purely visual.

func _draw_volley():
	if _battle_done():
		return
	for shot in battle_shots:
		_draw_shot(shot)

func _draw_shot(shot):
	var last_hit = shot.events[0]
	if last_hit.is_empty() or _battle_done():
		return
	var age = battle_clock - shot.at
	if age < 0 or age >= 1.03:
		return
	var source_unit = "tank_t1"
	for st in report.initial[int(last_hit.side)]:
		if st.slot == last_hit.from:
			source_unit = st.unitId
	var pose = _battle_pose(source_unit, int(last_hit.side), int(last_hit.from))
	var origin = pose.muzzle
	var indirect = source_unit.begins_with("rocket") or source_unit.begins_with("spg")
	var descent_degrees = 60.0 if source_unit.begins_with("spg") else 45.0
	if age < 0.22:
		draw_set_transform(origin, pose.launch.angle())
		_effect(0, Rect2(-2, -24, 68, 48), Color(1, 1, 1, 1 - age / 0.22))
		draw_set_transform(Vector2.ZERO)
	for e in shot.events:
		var target = _unit_position(1 - int(e.side), int(e.to)) - Vector2(0, 20)
		if e.get("ground", false):
			target = _battle_position(1-int(e.side),int(e.to)) + _ground_displacement(1-int(e.side),maxf(0,age-0.32))
		if age < 0.32:
			var trail = _shot_trail(origin,target,pose.launch,age,indirect,descent_degrees)
			if trail.is_empty(): continue
			var streak = Color("ffb331")
			var tip = Color("fff4b1")
			streak.a = trail.opacity
			tip.a = trail.opacity
			draw_line(trail.tail, trail.head, Color(0.99, 0.48, 0.10, 0.22 * trail.opacity), 12, true)
			draw_line(trail.tail, trail.head, streak, 3, true)
			draw_circle(trail.head, 3.5, tip)
		else:
			var burst = (age - 0.32) / 0.71
			if not e.miss:
				var extent = (75.0 if e.get("ground",false) else 130.0) + sin(minf(burst * 2, 1) * PI * 0.5) * 38
				_effect(1, Rect2(target - Vector2(extent * 0.5, extent * 0.62), Vector2.ONE * extent), Color(1, 1, 1, minf(1, (1 - burst) * 1.9)))
				for i in range(10):
					var direction = Vector2.from_angle(i * 2.39 + e.to)
					var point = target + direction * (15 + burst * 80)
					draw_line(point - direction * 8, point, Color(1, 0.72, 0.25, 1 - burst), 3, true)
			if e.get("ground",false):
				_text("空位着弹",target+Vector2(-28,-26-burst*15),14,Color(0.83,0.76,0.6,1-burst))
				continue
			var label = "闪避" if e.miss else "−" + _amount(e.damage)
			var label_size = 22 if e.miss else 32 if e.critical else 28
			var w = bold.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size).x
			var text_pos = target + Vector2(-w * 0.5, -35 - burst * 35)
			text_pos.y = clampf(text_pos.y,125,780)
			text_pos.x = clampf(text_pos.x,22,1578-w)
			var alpha = minf(1, (1 - burst) * 3)
			draw_string_outline(bold, text_pos + Vector2(2, 3), label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size, 6, Color(0.09, 0.06, 0.025, alpha))
			draw_string_outline(bold, text_pos, label, HORIZONTAL_ALIGNMENT_LEFT, -1, label_size, 2, Color(0.9, 0.18, 0.04, alpha))
			_text(label, text_pos, label_size, Color(1, 0.80, 0.22, alpha) if not e.miss else Color(0.85, 0.92, 0.83, alpha), true)
			var feedback="暴击" if e.critical else ""
			if e.remaining==0 and not e.miss: feedback+=" 击毁"
			elif not e.miss and report.ruleset in ["classic-combat-v0.10","classic-combat-v0.14","classic-combat-v0.20","classic-combat-v0.22","classic-combat-v0.24.3"]:
				var attacker=""
				var defender=""
				for st in report.initial[int(e.side)]:
					if st.slot==e.from: attacker=st.classId
				for st in report.initial[1-int(e.side)]:
					if st.slot==e.to: defender=st.classId
				for rule in catalog.rules.matchup:
					if rule.attackerClass==attacker and rule.defenderClass==defender and rule.multiplierBps>10000: feedback+=" 克制"
			if feedback!="": _text(feedback.strip_edges(),text_pos+Vector2(0,18),14,GOLD,true)

func _battle_actor_label():
	var event = last_hit if not last_hit.is_empty() else report.events[0] if not report.events.is_empty() else {}
	if event.is_empty(): return "战斗结束"
	for st in report.initial[int(event.side)]:
		if st.slot==event.from:
			return ("我方攻击 · " if event.side==0 else "敌方攻击 · ") + str(catalog.classNames[st.classId])
	return "战斗结束"

func _battle_round_label():
	# Historical snapshots keep their original limit; never use the final duration as the denominator.
	var limit = int(report.get("roundLimit",40))
	return "%d / %d" % [int(last_hit.get("round",1)),limit]

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
		var x_stats = 440 if side == 0 else 1295
		if report.has("tactics"):
			var stats = report.tactics.teams[side]
			_small("先手 %d  ·  %s" % [stats.initiative, "先攻" if report.tactics.firstSide == side else "后攻"], Vector2(x_stats, 34), 15, GOLD)
			_small("二次开火 %d  ·  %.1f%%" % [stats.extraFire, report.tactics.chances[side] / 100.0], Vector2(x_stats, 57), 14, Color("bdc1ad"))
		else:
			_small("历史战报 · 按原记录回放", Vector2(x_stats, 47), 13, Color("bdc1ad"))
	draw_string_outline(latin, Vector2(753, 53), "VS", HORIZONTAL_ALIGNMENT_LEFT, -1, 48, 4, Color("060b0a"))
	_small("VS", Vector2(753, 53), 48, GOLD)
	var round_label = _battle_round_label()
	var round_width = latin.get_string_size(round_label,HORIZONTAL_ALIGNMENT_LEFT,-1,19).x
	_small(round_label,Vector2(800-round_width*0.5,78),19,TEXT)
	draw_line(Vector2(0, 88), Vector2(1600, 88), GOLD.darkened(0.45), 2)

func _draw_battle():
	if _battle_done() and settlement_visible and report.has("summary"):
		_draw_settlement()
		return
	_battle_ground()
	_draw_battle_craters()
	# Painter ordering follows projected depth, so front vehicles cover rear scenery correctly.
	var units: Array = []
	for side in range(2):
		for st in battle_armies[side]:
			units.append({"stack": st, "side": side})
	units.sort_custom(func(a, b): return _unit_position(a.side, a.stack.slot).y < _unit_position(b.side, b.stack.slot).y)
	for item in units:
		if item.stack.totalHp<=0: _draw_battle_vehicle(item.stack,item.side)
	for item in units:
		if item.stack.totalHp>0: _draw_battle_vehicle(item.stack,item.side)
	_draw_volley()
	_draw_destructions()
	battle_labels.clear()
	for item in units: _draw_battle_label(item.stack,item.side)
	_battle_header()
	_panel(Rect2(22,96,520,47),Color("17241e"),LINE)
	_text(_battle_actor_label(),Vector2(39,126),18,GREEN if last_hit.get("side",report.events[0].side if not report.events.is_empty() else 0)==0 else RED)
	if hover.begins_with("battleUnit:"):
		for item in units:
			var st = item.stack
			if hover == "battleUnit:%d:%d" % [item.side, st.slot]:
				_panel(Rect2(25, 152, 315, 64), Color(0.05, 0.10, 0.08, 0.92), GOLD.darkened(0.3))
				_text(catalog.units[st.unitId].name + "  ×%d" % st.count, Vector2(40, 178), 19, TEXT, true)
				_small("%s · 阵位 %d · 生命 %d" % ["我方" if item.side == 0 else "敌方", st.slot, st.totalHp], Vector2(40, 201), 14, MUTED)
	var done = _battle_done()
	_panel(Rect2(0, 839, 1600, 61), Color(0.035, 0.065, 0.058, 0.98), Color("64705a"))
	if done:
		if info.repairSummary.damaged > 0:
			_button("nav:repair", "维修车间 · 待修 %d" % info.repairSummary.damaged, Rect2(1264, 787, 310, 39), "repair", true)
		_text(("演习胜利" if report.mode == "training" else "作战胜利") if report.winner == 0 else "行动受挫", Vector2(26, 879), 28, GOLD if report.winner == 0 else RED, true)
		if report.mode == "training":
			_text("演习不解锁关卡 · 无战损", Vector2(191, 877), 17, MUTED)
		else:
			_text("装运记录" if report.mode == "world" else "缴获", Vector2(192, 875), 15, GOLD)
			_cost(report.rewards, Vector2(242, 869))
			if not report.get("coreRewards", {}).is_empty():
					_text("含核心奖励 · 详见战报", Vector2(780, 877), 13, GOLD)
		_button("battleSettlement", "战后结算", Rect2(1010, 850, 150, 39))
		_button("battleReplay", "再次回放", Rect2(1172, 850, 150, 39))
		_button("nav:campaign", "返回世界" if report.mode == "world" else "返回战役", Rect2(1334, 850, 241, 39), "world" if report.mode == "world" else "campaign", true)
	else:
		_text("已暂停" if battle_paused else "交战中", Vector2(26, 876), 20, GOLD, true)
		var action_label = "装甲部队接敌 · 悬停战车查看详情"
		if not last_hit.is_empty():
			var verb = "六发齐射" if _volley_class() == "rocket" else "开火 %d/%d" % [last_hit.get("shot", 1), last_hit.get("shots", 1)]
			action_label = "%s %d 号 · %s%s" % ["我方" if last_hit.side == 0 else "敌方", last_hit.from, "二次开火 · " if last_hit.get("extra", false) else "", verb]
		_text(action_label, Vector2(131, 876), 16, TEXT)
		_bar(Rect2(521, 866, 362, 4), float(battle_index) / maxi(1, report.events.size()), GOLD)
		_button("battlePause", "继续" if battle_paused else "暂停", Rect2(927, 850, 130, 39))
		_button("battleSpeed", "×%d 速度" % int(battle_speed), Rect2(1069, 850, 130, 39))
		_button("battleStep", "下一攻击 N", Rect2(1211, 850, 110, 39))
		_button("battleSkip", "跳过战斗", Rect2(1334, 850, 241, 39))
		# A bright field-green inset distinguishes the original's skip action.
		draw_rect(Rect2(1337, 853, 235, 33), Color(0.25, 0.53, 0.18, 0.22))

func _unit_guide():
	var u = catalog.units[_unit_id()]
	var effective = info.unitStats[u.unitId]
	var lines: Array[String] = [u.name, catalog.classDescriptions[u.classId], "",
		"基础攻击 %d → 科技与技能加成后 %d（实际伤害另受数量、克制、光环、命中与暴击影响）" % [u.attack, effective.attack],
		"基础生命 %d → 科技加成后 %d；每辆载重 %d" % [u.hp, effective.hp, info.unitStats[u.unitId].load],
		"生产每辆：" + _cost_text(effective.produce.unitCost) + "，原时长 " + _time(effective.produce.duration),
		"维修每辆：" + _cost_text(info.unitStats[u.unitId].repair.unitCost) + "（含材料科技），耗时 " + _time(info.unitStats[u.unitId].repair.duration),
		"制造：本厂 %d 级；改装：改装厂与任一制造工厂均需 %d 级。" % [u.unlock.factoryLevel,u.unlock.factoryLevel], "VI / VII 阶还需对应副本核心；改装消耗低一阶待命战车。已有车辆仍可使用和维修。", "", "【攻击模式】"]
	for c in CLASSES:
		lines.append(catalog.classNames[c] + "：" + catalog.classDescriptions[c])
	lines.append("坦克：每列优先前排，前排空则打同列后排，整列空跳过，共1至3发，不打地面。歼击车：正对列的第一个存活目标。火炮：正对列存活目标各一发。整列为空时找最近邻列，同距先小列号。火箭：六阵位固定六发，空位留下随地面后移的弹坑。")
	lines.append("经典攻击范围依据官网原有攻击模式说明。火箭齐射按每个目标结算，不再附加 35% 群攻折扣。")
	lines.append("同类光环不重复叠加，相关兵种阵位全部阵亡后光环消失。基础属性、光环数值和空位选敌顺序为本作单机设定。")
	lines.append("\n【当前兵种对各类目标的伤害倍率】")
	for m in catalog.rules.matchup:
		if m.attackerClass == u.classId:
			lines.append("对 " + catalog.classNames[m.defenderClass] + "：%.2f 倍" % (m.multiplierBps / 10000.0))
	lines.append("\n【先手与二次开火】\n双方属性取出战阵位的整数平均值，不按数量叠加。\n先手 = 100 +（阶级 − 1）×6 + 机动推进等级×3 + 战场预判等级×3。\n二次开火 = 100 +（阶级 − 1）×5 + 精密弹道等级×4 + 连击指挥等级×4。\n追加概率 = 10% + 双方二次开火值差×0.1%，限制在 0%–35%。\n每个大回合各阵位行动一次，少阵位一方等候；连击归属当前小回合，不连锁。\n以上为本作单机规则。")
	lines.append("\n【六格与战损】\n前排 1 / 2 / 3，后排 4 / 5 / 6，同列为 1—4、2—5、3—6。\n每格受统率上限约束，同型跨格共用库存；出征中的部队不可重复部署。\n正式战斗损失按同型号汇总，80% 向上取整进入待修，其余永久损失。\n演习不改变兵力、不发奖励；正式战役可重复挑战，首通奖励只发一次。")
	_details("兵种图鉴 / " + u.name, "\n".join(lines))

func _report_details():
	var lines: Array[String] = [report.title,
		"结算结果：" + ("胜利" if report.winner == 0 else "失利") + "；回放不会再次结算奖励。", ""]
	if report.get("endReason","")=="round-limit":
		lines.append("第 %d 个大回合结束后双方仍有部队，%s为先手方，超时判负。" % [report.roundLimit,"我方" if report.tactics.firstSide==0 else "敌方"])
	lines.append("【本次所得】" + (" · "+_cargo_label() if report.mode=="world" else ""))
	for reward in _settlement_rewards(): lines.append(reward.name+" +"+QuantityFormat.exact(reward.count))
	if _settlement_rewards().is_empty(): lines.append("演习不发奖励。" if report.mode=="training" else "本场无奖励。")
	if report.has("summary"):
		lines.append("我方生还 %d / 待修 %d / 永久损失 %d" % [report.summary.teams[0].survived, report.summary.repairable, report.summary.destroyed])
		for side in range(2):
			lines.append("\n【我方阵位伤害 / 承伤】" if side == 0 else "\n【敌方阵位伤害 / 承伤】")
			for row in report.summary.teams[side].rows: lines.append("阵位 %d：%s  伤害 %d / 承伤 %d" % [row.slot,row.name,row.damage,row.get("received",0)])
	if report.has("tactics"):
		for side in range(2):
			var stats = report.tactics.teams[side]
			lines.append("%s：先手 %d，二次开火 %d，本场追加概率 %.1f%%" % ["我方" if side == 0 else "敌方", stats.initiative, stats.extraFire, report.tactics.chances[side] / 100.0])
		lines.append("每个大回合存活阵位各行动一次，双方交替；少阵位一方等待。连击归属当前小回合。" if report.ruleset in ["classic-combat-v0.14","classic-combat-v0.20","classic-combat-v0.22","classic-combat-v0.24.3"] else "历史规则：每回合双方各行动一次，各自按存活阵位循环；先手同值时进攻方先行。")
		lines.append("二次开火最多追加一次完整攻击，不连锁；击毁目标不奖励额外行动。")
		for action in report.get("actions", []):
			if action.get("extraTriggered", false):
				lines.append("行动 %d：%s阵位 %d 触发二次开火。" % [action.id, "我方" if action.side == 0 else "敌方", action.from])
	if report.mode == "training":
		lines.append("本场为演习：生还与损失只表示推演结果，实际库存不变，不发奖励。\n")
	for side in range(2):
		lines.append("【我方出战】" if side == 0 else "【敌方出战】")
		for st in report.initial[side]:
			lines.append("阵位 %d  %s × %d  单车生命 %d  基础攻击 %d" % [st.slot, catalog.units[st.unitId].name, st.count, st.hp, st.attack])
	lines.append("\n【我方结算】")
	for c in report.casualties:
		lines.append("%s：出战 %d / 生还 %d / 待修 %d / 永久损失 %d" % [catalog.units[c.unitId].name, c.sent, c.survived, c.repairable, c.destroyed])
	lines.append(("原始战时装运：" if report.mode == "world" else "物资奖励：") + _cost_text(report.rewards))
	if report.mode=="world": lines.append("后续远征："+_cargo_label()+" · "+_cost_text(report.get("transport",{}).get("cargo",{})))
	for core_id in report.get("coreRewards", {}):
		lines.append("核心缴获：" + catalog.coreNames[core_id] + " ×%d" % report.coreRewards[core_id])
	var growth = report.get("growth", {})
	if not growth.is_empty():
		lines.append("经验 +%d / 声望 +%d / 统率书 +%d / 技能点 +%d" % [growth.xp, growth.prestige, growth.books, growth.skillPoints])
	lines.append("\n【逐次伤害日志】")
	for e in report.events:
		if e.has("action"):
			lines.append("行动 %d · %s · 第 %d/%d 发" % [e.action, "二次开火" if e.extra else "常规开火", e.shot, e.shots])
		if e.has("exchange"): lines.append("大回合 %d / 小回合 %d"%[e.round,e.exchange])
		if e.get("ground",false):
			lines.append("阵位 %d → 空阵位 %d：地面着弹，无伤害，不计闪避或击毁。"%[e.from,e.to])
		else:
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
	if "--experience25-only" in OS.get_cmdline_user_args():
		var passed = await _experience25_qa(out)
		print("V25_EXPERIENCE_QA: ",passed)
		get_tree().quit(0 if passed else 67)
		return
	if "--round-hud-only" in OS.get_cmdline_user_args():
		var passed = await _round_hud_qa(out)
		if passed: passed = await _combat_qa(out,"v22")
		if passed: passed = await _rocket_live_qa(out)
		print("V243_ROUND_QA: ",passed)
		get_tree().quit(0 if passed else 66)
		return
	if "--indirect-fire-only" in OS.get_cmdline_user_args():
		var passed = await _combat_qa(out,"v22")
		if passed: passed = await _rocket_live_qa(out)
		if passed: passed = await _indirect_fire_qa(out)
		print("V242_INDIRECT_QA: ",passed)
		get_tree().quit(0 if passed else 65)
		return
	if "--rocket-salvo-only" in OS.get_cmdline_user_args():
		var passed = await _combat_qa(out,"v22")
		if passed: passed = await _rocket_live_qa(out)
		print("V241_ROCKET_QA: ",passed)
		get_tree().quit(0 if passed else 64)
		return
	if "--core-chapters-only" in OS.get_cmdline_user_args():
		var passed = await _core_chapters_qa(out)
		print("V24_NATIVE_QA: ", passed)
		get_tree().quit(0 if passed else 63)
		return
	if "--dispatch-only" in OS.get_cmdline_user_args():
		var passed = await _dispatch_qa(out)
		print("V23_NATIVE_QA: ", passed)
		get_tree().quit(0 if passed else 62)
		return
	if "--unlock-only" in OS.get_cmdline_user_args():
		var passed=await _v21_qa(out)
		print("V21_NATIVE_QA: ",passed)
		get_tree().quit(0 if passed else 60)
		return
	if "--tank-targets-only" in OS.get_cmdline_user_args():
		var passed=await _combat_qa(out,"v22")
		print("V22_NATIVE_QA: ",passed)
		get_tree().quit(0 if passed else 61)
		return
	if "--combat-only" in OS.get_cmdline_user_args():
		var passed=await _combat_qa(out)
		print("V20_NATIVE_QA: ",passed)
		get_tree().quit(0 if passed else 59)
		return
	if "--pacing-only" in OS.get_cmdline_user_args():
		var passed=await _v19_qa(out)
		print("V19_NATIVE_QA: ",passed)
		get_tree().quit(0 if passed else 58)
		return
	if "--economy-only" in OS.get_cmdline_user_args():
		var passed=await _v18_qa(out)
		get_tree().quit(0 if passed else 57)
		return
	if "--growth-only" in OS.get_cmdline_user_args():
		var passed=await _v17_qa(out)
		get_tree().quit(0 if passed else 56)
		return
	if "--library-only" in OS.get_cmdline_user_args():
		var passed=await _v16_qa(out)
		get_tree().quit(0 if passed else 55)
		return
	if "--v15-only" in OS.get_cmdline_user_args():
		var passed=await _v15_qa(out)
		print("V15_NATIVE_QA: ",passed)
		get_tree().quit(0 if passed else 54)
		return
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
	_action("deploymentConfirm")
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
	if not details_text.text.contains("逐次伤害日志") or not details_text.text.contains("结算结果"):
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
	await _settled()
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
	await _settled()
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
	if not s.jobs.has("production:refit") or s.jobs["production:refit"].get("sourceUnitId", "") != "tank_t6":
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
	selected_factory = "factory"
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
	_action("deploymentConfirm")
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
	if not await _v08_qa(out):
		print("NATIVE_SMOKE_FAILED: v08 repair / independent factories")
		get_tree().quit(45)
		return
	stats["v08_repair_industry_parallel_and_cancel"] = "pass"
	if not await _v09_qa(out):
		print("NATIVE_SMOKE_FAILED: v09 tree / instant VIP / travel")
		get_tree().quit(46)
		return
	stats["v09_research_tree_auto_vip_economy"] = "pass"
	if not await _v091_qa(out):
		print("NATIVE_SMOKE_FAILED: v091 pre-battle deployment")
		get_tree().quit(47)
		return
	stats["v091_deployment_edit_cancel_confirm"] = "pass"
	if not await _v10_qa(out):
		print("NATIVE_SMOKE_FAILED: v10 movement / sequential fire / tactics")
		get_tree().quit(48)
		return
	stats["v10_axis_motion_sequential_fire_tactics_replay"] = "pass"
	if not await _v11_qa(out):
		print("NATIVE_SMOKE_FAILED: v11 direct upgrade / inventory / settlement / core icons")
		get_tree().quit(49)
		return
	stats["v11_industry_inventory_settlement_core_icons"] = "pass"
	FileAccess.open(out.path_join("smoke.json"), FileAccess.WRITE).store_string(JSON.stringify(stats, "  "))
	if not await _v12_qa(out):
		print("NATIVE_SMOKE_FAILED: v12 experience / resolutions")
		get_tree().quit(51)
		return
	stats["v12_state_scroll_steps_world_settings_resolutions"]="pass"
	if not await _v13_qa(out):
		print("NATIVE_SMOKE_FAILED: v13 repair / archive / planning")
		get_tree().quit(52)
		return
	stats["v13_repair_limits_archives_preview_presets_honors"]="pass"
	if not await _v14_qa(out):
		print("NATIVE_SMOKE_FAILED: v14 rounds / power / chapters / command")
		get_tree().quit(53)
		return
	stats["v14_rounds_power_chapters_command_retry"]="pass"
	if not await _v15_qa(out):
		print("NATIVE_SMOKE_FAILED: v15 recovery / core mainline / attributes")
		get_tree().quit(54)
		return
	stats["v15_repair_all_core_mainline_attributes"]="pass"
	if not await _v16_qa(out):
		print("NATIVE_SMOKE_FAILED: library")
		get_tree().quit(55)
		return
	stats["v16_library"]="pass"
	if not await _v17_qa(out):
		print("NATIVE_SMOKE_FAILED: growth and amount format")
		get_tree().quit(56)
		return
	stats["v17_growth120_resource_format"]="pass"
	if not await _v18_qa(out):
		print("NATIVE_SMOKE_FAILED: economy and world")
		get_tree().quit(57)
		return
	stats["v18_economy_world_transport"]="pass"
	FileAccess.open(out.path_join("smoke.json"),FileAccess.WRITE).store_string(JSON.stringify(stats,"  "))
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
		_battle_step(10000)
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
		_battle_step(10000)
		var natural = _unit_position(death.side, death.slot)
		var natural_time = battle_clock
		for speed in [1, 2, 4]:
			open_report(fixture)
			battle_speed = speed
			battle_paused = true
			_battle_step(10000)
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

func _dispatch_qa_click(id):
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	for b in buttons:
		if b.id == id and b.enabled:
			var event = InputEventMouseButton.new()
			event.position = b.rect.get_center()
			event.button_index = MOUSE_BUTTON_LEFT
			event.pressed = true
			_gui_input(event)
			return true
	print("V23 missing button: ", id)
	return false

func _core_chapters_qa(out):
	if "smoke" not in save_root: return false
	request({"op":"import", "text":FileAccess.get_file_as_string(out.path_join("ready-save.json"))})
	await _settled()
	if catalog.dungeons.size()!=80 or catalog.coreChapters.size()!=5 or s.arsenal.cleared.size()!=63: return false
	campaign_mode="dungeon"
	_navigate("campaign")
	get_window().size=Vector2i(1280,720)
	for c in range(5):
		if not await _dispatch_qa_click("coreChapter:"+str(c)): return false
		if int(selected_dungeon/16)!=c: return false
		await _qa_capture(out,"chapter-"+str(c+1))
	if not await _dispatch_qa_click("coreRoute"): return false
	if not details_dialog.visible or "第5章" not in details_text.text: return false
	await _qa_capture(out,"chapter-supply-budget")
	details_dialog.hide()
	await _dispatch_qa_click("coreChapter:3")
	if selected_dungeon!=63 or info.dungeonStatus[64].block=="": return false
	var target=catalog.dungeons[selected_dungeon]
	var before=s.arsenal.cores.duplicate(true)
	if not await _dispatch_qa_click("dungeonAttack"): return false
	if screen!="deployment" or deployment.guardTech!=target.guardTech: return false
	var preview=_formation_tactics(deployment.enemy,false)
	await _dispatch_qa_click("deploymentEnemy")
	await _qa_capture(out,"chapter-4-prebattle")
	await _dispatch_qa_click("deploymentConfirm")
	await _settled()
	if screen!="battle" or report.winner!=0: return false
	if report.initial[1][0].initiative!=preview.initiative: return false
	if not target.id in s.arsenal.cleared or info.dungeonStatus[64].block!="": return false
	for drop in target.drops:
		if s.arsenal.cores[drop.id]!=before[drop.id]+drop.first: return false
	_action("battleSkip")
	if not settlement_visible: return false
	await _qa_capture(out,"chapter-4-first-clear")
	before=s.arsenal.cores.duplicate(true)
	if not await _dispatch_qa_click("rematch"): return false
	await _settled()
	if screen!="battle" or report.target.dungeonId!=target.id: return false
	for drop in target.drops:
		var n=s.arsenal.cores[drop.id]-before[drop.id]
		if n<drop.min or n>drop.max: return false
	_action("battleSkip")
	await _qa_capture(out,"chapter-4-repeat-rewards")
	before=s.arsenal.cores.duplicate(true)
	var history=report.initial.duplicate(true)
	_action("battleReplay")
	_action("battlePause")
	_action("battleStep")
	await get_tree().create_timer(0.2).timeout
	_action("battleSkip")
	if s.arsenal.cores!=before or report.initial!=history: return false
	var captures=[]
	for size_value in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=size_value
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			_navigate("campaign")
			selected_dungeon=79
			await _qa_capture(out,"core-%dx%d-%d"%[size_value.x,size_value.y,int(scale_value*100)])
			captures.append({"window":[size_value.x,size_value.y],"scale":scale_value})
	get_window().mode=Window.MODE_FULLSCREEN
	await _qa_capture(out,"core-fullscreen-120")
	get_window().mode=Window.MODE_WINDOWED
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	# An unearned, locked final stage can be rehearsed but never grants a clear or rewards.
	before=s.arsenal.cores.duplicate(true)
	var cleared=s.arsenal.cleared.duplicate()
	for c in range(5):
		_navigate("campaign")
		selected_dungeon=c*16+15
		await _dispatch_qa_click("dungeonTraining")
		await _dispatch_qa_click("deploymentConfirm")
		await _settled()
		if _battle_environment()!="ground_"+catalog.dungeons[selected_dungeon].theme: return false
		settlement_visible=false
		battle_paused=true
		await _qa_capture(out,"chapter-%d-battle"%(c+1))
		_action("battleSkip")
	if s.arsenal.cleared!=cleared or s.arsenal.cores!=before: return false
	request({"op":"save"})
	await _settled()
	request({"op":"load","id":s.id})
	await _settled()
	if s.arsenal.cleared!=cleared or s.arsenal.cores!=before: return false
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("legacy-save.json"))})
	await _settled()
	campaign_mode="dungeon"
	_navigate("campaign")
	selected_dungeon=48
	if s.arsenal.cleared.size()!=16 or info.dungeonStatus[48].block!="" or info.dungeonStatus[52].block=="": return false
	await _qa_capture(out,"legacy-clears-preserved")
	FileAccess.open(out.path_join("v24-acceptance.json"),FileAccess.WRITE).store_string(JSON.stringify({"pass":true,"save_root":save_root,"chapters":5,"stages":80,"mouse_chapter_selection":true,"prebattle_stats_match_snapshot":true,"chapter_boundary_unlock":true,"first_and_repeat_rewards":true,"rematch_skips_deployment":true,"replay_no_credit":true,"locked_rehearsal_no_reward":true,"save_reload":true,"legacy_16_clears_preserved":true,"chapter_themes":5,"captures":captures,"fullscreen":true},"  "))
	return true

func _dispatch_qa(out):
	request({"op":"import", "text":FileAccess.get_file_as_string(out.path_join("busy-save.json"))})
	await _settled()
	if _dispatch_groups().size() != 7 or info.dispatch.expeditions.active != 3: return false
	_navigate("base")
	get_window().size = Vector2i(1280,720)
	ui_scale = 1.0
	await _qa_capture(out, "base-busy")
	if not await _dispatch_qa_click("dispatchOpen:factory"): return false
	if screen != "queues" or dispatch_selected != "factory": return false
	await _qa_capture(out, "factory-active-waiting")
	if not await _dispatch_qa_click("queueNext"): return false
	if queue_page != 1: return false
	await _qa_capture(out, "factory-waiting-page2")
	await _dispatch_qa_click("dispatchSelect:factory2")
	if queue_page != 0 or dispatch_selected != "factory2": return false
	await _dispatch_qa_click("dispatchSelect:factory")
	var q = _dispatch_station("factory")
	var cancelled = q.rows[1].seq
	await _dispatch_qa_click("cancel:"+str(int(cancelled)))
	if not confirm_dialog.visible: return false
	_confirm_action()
	await _settled()
	if _dispatch_station("factory").waiting != 4 or _dispatch_station("factory2").waiting != 2: return false
	var active = _dispatch_station("factory").rows[0]
	var amount = int(s.available[active.target])
	await _dispatch_qa_click("accelerate:"+str(int(active.seq)))
	if not confirm_dialog.visible: return false
	_confirm_action()
	await _settled()
	if int(s.available[active.target]) != amount + int(active.total-active.completed): return false
	if _dispatch_station("factory").waiting != 3 or _dispatch_station("factory").rows[0].seq == active.seq: return false
	await _dispatch_qa_click("dispatchSelect:research")
	await _dispatch_qa_click("dispatchProject:"+str(int(_dispatch_station("research").rows[0].seq)))
	if screen != "research" or selected_tech != "attack": return false
	_navigate("queues")
	if dispatch_selected != "research": return false
	await _dispatch_qa_click("dispatchSelect:expeditions")
	var first = info.dispatch.expeditions.rows[0]
	await _dispatch_qa_click("dispatchMarch:"+first.id)
	if screen != "world" or selected_site != first.targetId: return false
	_navigate("queues")
	if dispatch_selected != "expeditions": return false
	await _dispatch_qa_click("recall:"+first.id)
	if not confirm_dialog.visible: return false
	_confirm_action()
	await _settled()
	for m in info.dispatch.expeditions.rows:
		if m.id == first.id and m.phase != "returning": return false
	# Restore a busy isolated copy for consistent cross-resolution captures.
	request({"op":"import", "text":FileAccess.get_file_as_string(out.path_join("busy-save.json"))})
	await _settled()
	var captures = []
	for size_value in [Vector2i(1180,680), Vector2i(1280,720), Vector2i(1920,1080), Vector2i(2560,1440)]:
		get_window().size = size_value
		for scale_value in [1.0, 1.2]:
			ui_scale = scale_value
			_navigate("base")
			await _qa_capture(out, "base-%dx%d-%d" % [size_value.x,size_value.y,int(scale_value*100)])
			for group in ["building", "factory", "expeditions"]:
				_action("dispatchOpen:"+group, group)
				await _qa_capture(out, "%s-%dx%d-%d" % [group,size_value.x,size_value.y,int(scale_value*100)])
			captures.append({"window":[size_value.x,size_value.y], "scale":scale_value})
	get_window().mode = Window.MODE_FULLSCREEN
	ui_scale = 1.2
	_navigate("base")
	await _qa_capture(out, "base-fullscreen-120")
	_action("dispatchOpen:expeditions", "expeditions")
	await _qa_capture(out, "expeditions-fullscreen-120")
	get_window().mode = Window.MODE_WINDOWED
	get_window().size = Vector2i(1280,720)
	ui_scale = 1.0
	_navigate("base")
	await _dispatch_qa_click("building:lab")
	if base_panel != "facility" or selected_building != "lab": return false
	await _qa_capture(out, "base-building-inspector")
	var key = InputEventKey.new()
	key.keycode = KEY_ESCAPE
	key.pressed = true
	_unhandled_key_input(key)
	if screen != "base" or base_panel != "dispatch": return false
	key.keycode = KEY_Q
	_unhandled_key_input(key)
	if screen != "queues": return false
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	key.keycode = KEY_TAB
	_unhandled_key_input(key)
	if focus_id == "": return false
	focus_id = "dispatchSelect:repair"
	key.keycode = KEY_ENTER
	_unhandled_key_input(key)
	if dispatch_selected != "repair": return false
	await _qa_capture(out, "repair-active")
	# Rest settles the actual paid orders, not the projection, then returning to
	# base must immediately show idle stations and completed cargo/vehicle counts.
	if not await _qa_drain_jobs():
		print("V23 rest did not drain jobs")
		return false
	if info.dispatch.active != 0 or info.dispatch.waiting != 0:
		print("V23 remaining work: ", info.dispatch)
		return false
	if s.expeditionLog.size() != 3 or s.available.tank_t7 != 1000: return false
	_navigate("base")
	await _qa_capture(out, "base-after-completion")
	request({"op":"import", "text":FileAccess.get_file_as_string(out.path_join("idle-save.json"))})
	await _settled()
	_navigate("base")
	await _qa_capture(out, "base-locked-and-damaged")
	await _dispatch_qa_click("dispatchOpen:factory2")
	await _qa_capture(out, "locked-factory")
	await _dispatch_qa_click("dispatchDestination")
	if screen != "industry": return false
	_navigate("base")
	await _dispatch_qa_click("dispatchOpen:repair")
	if _dispatch_station("repair").damaged != 7: return false
	await _dispatch_qa_click("dispatchDestination")
	if screen != "repair" or quantity != 7: return false
	# An ordinary running job completes through polling while base stays open.
	command({"type":"produce", "unitId":"tank_t1", "count":1})
	await _settled()
	_navigate("base")
	var before = s.available.tank_t1
	var live_started = _dispatch_station("factory").active == 1
	for i in range(1000):
		if _dispatch_station("factory").active == 0: break
		await get_tree().create_timer(0.1).timeout
	if not live_started or screen != "base" or _dispatch_station("factory").active != 0 or s.available.tank_t1 != before+1:
		print("V23 live completion failed: ", _dispatch_station("factory"))
		return false
	await _qa_capture(out, "base-live-completion")
	FileAccess.open(out.path_join("v23-acceptance.json"),FileAccess.WRITE).store_string(JSON.stringify({"pass":true,"seven_stations":true,"independent_factory_fifo":true,"mouse_expand_paging_cancel_accelerate":true,"project_and_map_navigation":true,"keyboard_q_enter_escape":true,"live_completion_without_navigation":true,"rest_and_return_refresh":true,"old_save_and_player_isolation":true,"captures":captures}, "  "))
	return true

func _qa_capture(out, name):
	toast_until = 0
	await get_tree().create_timer(0.09).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join(name + ".png"))

func _v08_qa(out):
	request({"op": "new", "nickname": "维修工业验收", "seed": 2601001})
	await _settled()
	_navigate("repair")
	await _qa_capture(out, "v08-repair-empty")
	if info.repairSummary.damaged != 0:
		return false
	_navigate("industry")
	await _qa_capture(out, "v08-industry-locked")
	for b in buttons:
		if b.id == "facilityUpgrade:factory2" and b.enabled:
			return false
	var path = out.path_join("industry-save.json")
	if not FileAccess.file_exists(path):
		print("V08_FAILED: missing industry fixture")
		return false
	request({"op": "import", "text": FileAccess.get_file_as_string(path)})
	await _settled()
	_navigate("repair")
	repair_unit = "tank_t1"
	await _qa_capture(out, "v08-repair-stock")
	_action("repairNext")
	await _qa_capture(out, "v08-repair-page2")
	_action("repairPrev")
	_action("repairMax")
	if quantity != info.unitStats[repair_unit].repair.max:
		return false
	var damaged = s.damaged[repair_unit]
	var available = s.available[repair_unit]
	_set_quantity(2)
	_action("repairStart")
	await _settled()
	if s.damaged[repair_unit] != damaged - 2 or not s.jobs.has("repair"):
		return false
	await _qa_capture(out, "v08-repair-working")
	_action("cancel:repair", {"seq": s.jobs.repair.seq})
	_confirm_action()
	await _settled()
	if s.damaged[repair_unit] != damaged:
		return false
	_action("repairStart")
	await _settled()
	_action("accelerate:repair", {"seq": s.jobs.repair.seq})
	_confirm_action()
	await _settled()
	if s.available[repair_unit] != available + 2 or s.damaged[repair_unit] != damaged - 2:
		return false
	selected_class = 0
	tier = 1
	_set_quantity(100)
	_action("facility:factory", "factory")
	_action("produce")
	await _settled()
	_action("facility:factory2", "factory2")
	_action("produce")
	await _settled()
	await _qa_capture(out, "v08-second-factory")
	_action("facility:refit", "refit")
	tier = 2
	_action("produce")
	await _settled()
	if info.queues.production.active != 3:
		print("V08_FAILED: three independent production lines")
		return false
	await _qa_capture(out, "v08-refit-factory")
	_navigate("industry")
	await _qa_capture(out, "v08-industry-parallel")
	_navigate("queues")
	await _qa_capture(out, "v08-independent-queues")
	var second_seq = s.jobs["production:factory2"].seq
	_action("cancel:factory2", {"seq": second_seq})
	_confirm_action()
	await _settled()
	if s.jobs.has("production:factory2") or not s.jobs.has("production") or not s.jobs.has("production:refit"):
		return false
	FileAccess.open(out.path_join("v08-regression.json"), FileAccess.WRITE).store_string(JSON.stringify({"empty_and_paginated_repair":"pass","repair_max_cancel_complete":"pass","locked_factory_ui":"pass","three_parallel_lines":"pass","cancel_one_line_keeps_others":"pass"}, "  "))
	return true

func _v06_qa(out):
	campaign_mode = "stage"
	selected_class = 0
	tier = 1
	production_mode = "produce"
	request({"op": "new", "nickname": "版本验收", "seed": 2601001})
	await _settled()
	selected_stage = 0
	_action("attack")
	_action("deploymentConfirm")
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
	_battle_step(10000)
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
	_action("deploymentConfirm")
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
	# Low-level VIP jobs now finish automatically. Use long orders for FIFO checks.
	command({"type": "upgrade", "building": "hq"})
	await _settled()
	if s.jobs.has("building") or s.buildings.hq != 2:
		return false
	request({"op": "import", "text": FileAccess.get_file_as_string(out.path_join("queue-save.json"))})
	await _settled()
	for b in ["iron", "oil", "factory", "warehouse"]:
		command({"type": "upgrade", "building": b})
	await _settled()
	for tech in ["attack", "construction", "resourceOutput"]:
		command({"type": "research", "tech": tech})
	for i in range(3):
		command({"type": "produce", "unitId": "tank_t1", "count": 100})
	await _settled()
	if info.queues.building.active != 4 or info.queues.production.waiting != 2 or info.queues.research.waiting != 2:
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
	FileAccess.open(out.path_join("v06-acceptance.json"), FileAccess.WRITE).store_string(JSON.stringify({"campaign_first_win_second_button_and_attack": "pass", "password_masking_and_root_recharge": "pass", "vip_building_parallel": 4, "production_and_research_waiting_each": 2, "destruction_animation_and_pause_pixels": "pass", "asset_identities": 28, "directional_views": 56, "wreck_views": 8, "destruction_frames": 16}, "  "))
	return true

func _v09_qa(out):
	request({"op": "new", "nickname": "科研起步", "seed": 2601001})
	await _settled()
	_navigate("research")
	research_branch = "economy"
	selected_tech = "ironOutput"
	await _qa_capture(out, "v09-research-locked")
	if info.researchQuotes.ironOutput.block == "":
		return false
	request({"op": "import", "text": FileAccess.get_file_as_string(out.path_join("tree-save.json"))})
	await _settled()
	for pair in [["economy", "titaniumOutput"], ["industry", "repairSpeed"], ["logistics", "survey"], ["combat", "ballistics"]]:
		_action("researchBranch:" + pair[0], pair[0])
		_action("techSelect:" + pair[1], pair[1])
		await _qa_capture(out, "v09-tree-" + pair[0])
	_action("researchBranch:industry", "industry")
	_action("techSelect:repairSpeed", "repairSpeed")
	var old = s.tech.repairSpeed
	_action("research:repairSpeed", "repairSpeed")
	await _settled()
	if s.tech.repairSpeed != old + 1 or s.jobs.has("research"):
		return false
	selected_factory = "factory"
	production_mode = "produce"
	selected_class = 0
	tier = 1
	_navigate("factory")
	_set_quantity(1)
	await _qa_capture(out, "v09-production-instant")
	old = s.available.tank_t1
	_action("produce")
	await _settled()
	if s.available.tank_t1 != old + 1 or s.jobs.has("production"):
		return false
	_navigate("world")
	selected_site = "site-0"
	await _qa_capture(out, "v09-world-free-gather")
	if info.marchQuotes["site-0"].outboundMs <= 0 or info.marchQuotes["site-0"].returnMs <= 0:
		return false
	FileAccess.open(out.path_join("v09-regression.json"), FileAccess.WRITE).store_string(JSON.stringify({"locked_tree": "pass", "four_branches": "pass", "instant_research": "pass", "instant_batch": "pass", "travel_quote_nonzero": "pass"}, "  "))
	return true

func _v091_qa(out):
	request({"op": "new", "nickname": "战前编队验收", "seed": 2601001})
	await _settled()
	_navigate("campaign")
	campaign_mode = "stage"
	selected_stage = 0
	var original = s.formation.duplicate(true)
	var troops = s.available.duplicate(true)
	var original_reports = s.reports.size()
	# Preserve an independently edited army draft when pre-battle deployment is cancelled.
	draft = info.usable.duplicate(true)
	draft[0].count = 7
	dirty = true
	_action("attack")
	if screen != "deployment" or draft[0].count != 7:
		return false
	await _qa_capture(out, "v091-deployment-before-confirm")
	if s.reports.size() != original_reports or s.formation != original or s.available != troops:
		return false
	_action("deploymentEnemy")
	await _qa_capture(out, "v091-enemy-preview")
	_action("deploymentEnemy")
	selected_slot = 0
	_action("slotcount")
	name_input.text = "5"
	_text_confirmed()
	text_dialog.hide()
	if draft[0].count != 5 or s.formation != original:
		return false
	# Exercise actual slot drag input rather than assigning the swap directly.
	await _qa_capture(out, "v091-deployment-edited")
	var press = InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = Vector2(150, 330)
	_gui_input(press)
	var release = InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	release.position = Vector2(150, 575)
	_gui_input(release)
	if draft[3] == null or draft[3].unitId != "tank_t1" or draft[3].count != 5:
		return false
	_action("deploymentCancel")
	if screen != "campaign" or s.formation != original or s.reports.size() != original_reports or not dirty or draft[0].count != 7:
		return false
	_action("attack")
	draft = [null,null,null,null,null,null]
	await _qa_capture(out, "v091-deployment-empty")
	for b in buttons:
		if b.id == "deploymentConfirm" and b.enabled:
			return false
	_action("deploymentConfirm")
	if deployment_pending or screen != "deployment":
		return false
	_action("formationAuto")
	if draft == [null,null,null,null,null,null] or s.formation != original:
		return false
	selected_slot = 0
	_action("slotcount")
	name_input.text = "5"
	_text_confirmed()
	text_dialog.hide()
	await _qa_capture(out, "v091-confirm-ready")
	# Target is captured on opening, not read back from whichever card is selected later.
	selected_stage = 1
	_action("deploymentConfirm")
	_action("deploymentConfirm")
	await _settled()
	if screen != "battle" or s.reports.size() != original_reports + 1 or report.title != catalog.stageNames[0] or s.formation[0].count != 5:
		return false
	if report.initial[0][0].slot != 1 or report.initial[0][0].count != 5:
		return false
	battle_paused = true
	await _qa_capture(out, "v091-confirmed-battle")
	_navigate("campaign")
	# Core preview and escape do not consume units or change campaign progression.
	campaign_mode = "dungeon"
	selected_dungeon = 0
	_action("dungeonTraining")
	if screen != "deployment" or deployment.command.type != "dungeon":
		return false
	await _qa_capture(out, "v091-core-deployment")
	var escape = InputEventKey.new()
	escape.keycode = KEY_ESCAPE
	escape.pressed = true
	_unhandled_key_input(escape)
	if screen != "campaign" or not deployment.is_empty():
		return false
	FileAccess.open(out.path_join("v091-regression.json"), FileAccess.WRITE).store_string(JSON.stringify({"open_does_not_battle":"pass","enemy_preview":"pass","manual_quantity_and_drag":"pass","cancel_restores_unsaved_army_draft":"pass","empty_formation_disabled":"pass","auto_fill_is_local":"pass","target_snapshot":"pass","double_click_only_one_battle":"pass","core_preview_and_escape":"pass"}, "  "))
	return true

func _settled():
	for i in range(200):
		await get_tree().create_timer(0.05).timeout
		if not waiting and requests.is_empty():
			return

func _qa_drain_jobs():
	for i in range(30):
		if s.jobs.is_empty() and s.get("jobBacklog",[]).is_empty(): return true
		command({"type":"rest","minutes":480})
		await _settled()
	return false


func _v10_qa(out):
	var fixtures = JSON.parse_string(FileAccess.get_file_as_string(out.path_join("v10-fixtures.json")))
	if not fixtures is Dictionary:
		return false
	var old_mute = muted
	muted = false
	for side in range(2):
		var axis = _ground_displacement(side, 1).normalized()
		for slot in range(1, 7):
			for i in range(200):
				var delta = _alive_position(side, slot, i * 0.037) - _battle_position(side, slot)
				if absf(delta.cross(axis)) > 0.0001 or delta.length() > 2.86:
					print("V10_FAILED: vehicle oscillates outside travel axis")
					return false
	for i in range(3):
		var fixture = fixtures.volleys[i]
		open_report(fixture)
		battle_paused = true
		battle_speed = 1
		var shots = [3, 2, 1][i]
		for n in range(shots):
			# Inspect flight then impact independently, including every muzzle/audio cycle.
			_battle_step(1.17 if n == 0 else 0.22)
			if not pending_hit or battle_audio_events.size() != n * 2 + 1 or last_hit.shot != n + 1:
				print("V10_FAILED: sequential launch ", i, ":", n)
				return false
			for e in battle_volley:
				var st = battle_armies[1].filter(func(unit): return unit.slot == e.to)[0]
				if st.totalHp == e.hp and not e.miss:
					print("V10_FAILED: damage before projectile arrives")
					return false
			if i == 0:
				await _qa_capture(out, "v10-tank-shot-%d" % (n + 1))
			_battle_step(0.30)
			if pending_hit or battle_audio_events.size() != n * 2 + 2:
				print("V10_FAILED: individual impact/audio ", i, ":", n)
				return false
			for e in battle_volley:
				var st = battle_armies[1].filter(func(unit): return unit.slot == e.to)[0]
				if st.totalHp != e.hp:
					return false
		var launches = battle_audio_events.filter(func(e): return e.key.ends_with("_fire"))
		if launches.size() != shots:
			return false
		for n in range(1, launches.size()):
			if absf(launches[n].at - launches[n - 1].at - 0.52) > 0.03:
				return false
		if i == 2 and battle_volley.size() != 6:
			return false
	# Frozen snapshots must not change with pause, speed, skip, or the legacy format.
	for fixture in fixtures.volleys + [fixtures.historical, fixtures.extra]:
		var result_time = -1.0
		for speed in [1, 2, 4]:
			open_report(fixture)
			battle_paused = true
			battle_speed = speed
			_battle_step(10000)
			if not _battle_done():
				return false
			if result_time < 0:
				result_time = battle_clock
			if absf(battle_clock - result_time) > 0.001:
				return false
			for side in range(2):
				for j in range(battle_armies[side].size()):
					if battle_armies[side][j].totalHp != fixture.final[side][j].totalHp:
						return false
		_action("battleSkip")
		if not _battle_done() or absf(battle_clock - result_time) > 0.001:
			return false
	open_report(fixtures.extra)
	battle_speed = 1
	battle_paused = true
	while not last_hit.get("extra", false) and not _battle_done():
		_battle_step(0.025)
	if not last_hit.get("extra", false):
		print("V10_FAILED: extra action missing")
		return false
	await _qa_capture(out, "v10-extra-fire")
	var frozen = get_viewport().get_texture().get_image().get_data()
	await get_tree().create_timer(0.12).timeout
	await RenderingServer.frame_post_draw
	if get_viewport().get_texture().get_image().get_data() != frozen:
		return false
	# Preview numbers agree with the rule process for the currently edited formation.
	_navigate("campaign")
	_begin_deployment({"type":"battle", "stage":0, "training":true})
	var preview = _formation_tactics(draft, true)
	var enemy_preview = _formation_tactics(deployment.enemy, false)
	await _qa_capture(out, "v10-deployment-tactics")
	_confirm_deployment()
	await _settled()
	if screen != "battle" or not report.has("tactics"):
		return false
	for side in range(2):
		var expected = preview if side == 0 else enemy_preview
		var actual = report.tactics.teams[side]
		# JSON numbers are floats; compare values rather than Dictionary variant types.
		if actual.initiative != expected.initiative or actual.extraFire != expected.extraFire:
			print("V10_FAILED: preview differs from resolved team values: ", expected, " / ", actual)
			return false
	battle_paused = true
	muted = old_mute
	_stop_battle_audio()
	FileAccess.open(out.path_join("v10-regression.json"), FileAccess.WRITE).store_string(JSON.stringify({"axis_motion_cases":2400,"tank_three_launches":"pass","spg_two_launches":"pass","rocket_six_target_salvo":"pass","per_shot_damage_and_audio":"pass","fire_interval_seconds":0.52,"extra_action_label":"pass","pause_pixels":"pass","speed_1_2_4_skip_legacy":"pass","deployment_matches_report_stats":"pass"}, "  "))
	return true


func _v11_qa(out):
	request({"op":"import", "text":FileAccess.get_file_as_string(out.path_join("v11-save.json"))})
	await _settled()
	_navigate("industry")
	await _qa_capture(out, "v11-industry-ready")
	for facility in ["factory", "factory2", "refit"]:
		var before_level = s.buildings.factory if facility == "factory" else s.industry[facility]
		_action("facilityUpgrade:" + facility, facility)
		await _settled()
		if screen != "industry":
			print("V11_FAILED: upgrade leaves industry")
			return false
		var found = info.jobs.filter(func(j): return j.kind == "building" and j.target == facility)
		if found.size() != 1 or info.facilities[facility].upgrade.booked == null:
			print("V11_FAILED: direct factory upgrade missing ", facility)
			return false
		await _qa_capture(out, "v11-upgrading-" + facility)
		_action("cancel:building", {"seq":found[0].seq})
		_confirm_action()
		await _settled()
		if (s.buildings.factory if facility == "factory" else s.industry[facility]) != before_level:
			return false
	request({"op":"import", "text":FileAccess.get_file_as_string(out.path_join("industry-cap-save.json"))})
	await _settled()
	_navigate("industry")
	await _qa_capture(out, "v11-industry-max")
	for b in buttons:
		if b.id.begins_with("facilityUpgrade:") and b.enabled:
			print("V11_FAILED: capped plant can upgrade")
			return false
	request({"op":"import", "text":FileAccess.get_file_as_string(out.path_join("v11-save.json"))})
	await _settled()
	inventory_owned = false
	inventory_class = "all"
	_action("nav:inventory", "inventory")
	if info.inventory.size() != 46:
		return false
	var wallet_before = s.wallet.duplicate(true)
	for category in ["all", "materials", "cores", "vehicles", "items"]:
		_action("inventoryCategory:" + category, category)
		await _qa_capture(out, "v11-inventory-" + category)
		var count_expected = {"all":46,"materials":6,"cores":8,"vehicles":28,"items":4}[category]
		if _inventory_entries().size() != count_expected:
			return false
	_action("inventoryCategory:cores", "cores")
	var core_images = {}
	for core in catalog.coreList:
		var key = _core_texture(core.id)
		if not textures.has(key) or core_images.has(key):
			print("V11_FAILED: duplicate core texture")
			return false
		core_images[key] = true
	_action("inventoryOwned")
	if _inventory_entries().size() != 5:
		return false
	await _qa_capture(out, "v11-inventory-owned-cores")
	_action("inventoryOwned")
	_action("inventoryClass:tank", "tank")
	if _inventory_entries().size() != 2:
		return false
	_inventory_details("tank_core7")
	if not details_text.text.contains("精英") or not details_text.text.contains("不能通用"):
		return false
	details_dialog.hide()
	_action("inventoryCategory:vehicles", "vehicles")
	_action("inventoryClass:all", "all")
	_action("inventoryNext")
	await _qa_capture(out, "v11-inventory-vehicle-page2")
	if inventory_page != 1 or _inventory_entries().size() != 28:
		return false
	# Screens are read-only (wallet may naturally grow while viewing).
	for id in RES:
		if s.wallet[id] < wallet_before[id]:
			return false
	var fixtures = JSON.parse_string(FileAccess.get_file_as_string(out.path_join("v11-reports.json")))
	for key in ["win", "lose", "core", "world", "legacy", "training"]:
		open_report(fixtures[key])
		battle_paused = true
		battle_speed = 4
		_action("battleSkip")
		if not _battle_done() or not settlement_visible or not report.has("summary"):
			return false
		await _qa_capture(out, "v11-settlement-" + key)
		if not buttons.any(func(b): return b.id == "battleField"):
			return false
		if key == "win":
			if _settlement_rewards().size() != 10:
				return false
			_action("rewardNext")
			await _qa_capture(out, "v11-settlement-growth")
		elif key == "core":
			if _settlement_rewards().size() != 2 or _settlement_rewards()[0].icon == _settlement_rewards()[1].icon:
				return false
		elif key == "training" and not _settlement_rewards().is_empty():
			return false
		elif key == "legacy" and not _cargo_label().contains("历史"):
			return false
		_action("battleField")
		await _qa_capture(out, "v11-field-" + key)
		if settlement_visible:
			return false
		_action("battleSettlement")
		if not settlement_visible:
			return false
	# Returning to an archived report must never settle it a second time.
	_navigate("campaign")
	_begin_deployment({"type":"battle", "stage":0, "training":true})
	_confirm_deployment()
	await _settled()
	var reports_before = s.reports.size()
	var damaged_before = s.damaged.duplicate(true)
	_action("reportSummary:" + report.id, report.id)
	await _settled()
	if not _battle_done() or not report.has("summary") or s.reports.size() != reports_before or s.damaged != damaged_before:
		return false
	await _qa_capture(out, "v11-archive-settlement")
	# Natural completion displays settlement without pressing skip.
	open_report(fixtures.win)
	battle_speed = 4
	battle_paused = false
	await get_tree().create_timer(1.5).timeout
	if not _battle_done():
		return false
	await _qa_capture(out, "v11-natural-settlement")
	if not buttons.any(func(b): return b.id == "battleField"):
		return false
	var original_size = get_window().size
	get_window().size = Vector2i(1120, 630)
	await _qa_capture(out, "v11-settlement-1120")
	get_window().size = original_size
	FileAccess.open(out.path_join("v11-regression.json"), FileAccess.WRITE).store_string(JSON.stringify({"direct_upgrade_three_plants":"pass","capped_plant_disabled":"pass","inventory_entries":46,"category_owned_class_pagination":"pass","distinct_core_textures":8,"win_loss_training_core_world_legacy":"pass","reward_pagination":"pass","natural_and_skipped_settlement":"pass","archive_readonly":"pass","minimum_window":"1120x630"}, "  "))
	return true

# Field desk design system: shared by native dialogs and the canvas controls.
func _apply_field_theme():
	for kind in ["Button", "LineEdit", "TextEdit", "Label", "CheckButton", "PopupMenu"]:
		theme.set_color("font_color", kind, TEXT)
		theme.set_color("font_disabled_color", kind, MUTED)
		theme.set_color("font_hover_color", kind, GOLD)
		theme.set_font_size("font_size", kind, 20)
	for kind in ["Button", "LineEdit", "TextEdit", "PopupMenu", "AcceptDialog", "Window"]:
		for state in ["normal", "hover", "pressed", "focus", "disabled", "read_only", "panel", "embedded_border", "embedded_unfocused_border"]:
			var style = StyleBoxFlat.new()
			style.bg_color = Color("304237") if state == "hover" else Color("514931") if state == "pressed" else PANEL
			style.border_color = GOLD if state in ["focus", "pressed", "embedded_border"] else LINE
			style.set_border_width_all(2 if state == "focus" else 1)
			style.set_content_margin_all(12)
			if state.begins_with("embedded"):
				style.expand_margin_top = 34
			theme.set_stylebox(state, kind, style)
	theme.set_color("title_color", "Window", GOLD)
	theme.set_font("title_font", "Window", bold)
	theme.set_font_size("title_font_size", "Window", 22)
	theme.set_constant("title_height", "Window", 34)

func _save_preferences():
	if test_mode: return
	var prefs = ConfigFile.new()
	prefs.set_value("audio", "muted", muted)
	prefs.set_value("audio", "volume", audio_volume)
	prefs.set_value("display", "text_scale", ui_scale)
	prefs.save("user://preferences.cfg")

func _experience_action(id, data):
	if id.begins_with("rewardInfo:"):
		_details("奖励明细 / "+data.name,data.name+" +"+QuantityFormat.exact(data.count)+"\n\n"+(_cargo_label() if data.cargo else "已自动计入当前存档；查看或回放不会再次发放。"))
	elif id=="battleNext":
		var next=_next_battle_target()
		if not next.is_empty():
			campaign_mode="stage" if next.type=="battle" else "dungeon"
			if next.type=="battle": selected_stage=int(next.stage)
			else:
				for i in range(catalog.dungeons.size()):
					if catalog.dungeons[i].id==next.dungeonId: selected_dungeon=i
			_begin_deployment(next)
	elif id=="mapClear":
		map_resource="all"
		map_level=0
		map_intel="all"
	elif id=="repairAll":
		var q=info.repairAll
		_confirm({"type":"repairAll","quote":q.token},"立即修复当前存档全部 %d 辆可维修车辆？\n需追加材料：%s\n其中 %d 辆正在维修，已付材料不重复扣除。\n\n确认后立即返回待命库存，不推进时间、不收金币。\n永久损失不恢复；此操作与历史战报的原始损耗分开。"%[q.count,_repair_material_text(),q.prepaid])
	elif id.begins_with("attributeScope:"): attribute_scope=str(data)
	elif id.begins_with("attributeClass:"): selected_class=int(data)
	elif id.begins_with("attributeTier:"): tier=int(data)
	elif id=="attributeRules": _details("属性战力口径",info.attributes.explanation+"\n\n当前编队按已保存且可用的部队计算；未保存的草稿不计入此表。战斗历史属性仍以原战报为准。\n\n装甲为抗暴属性；装甲加固科技实际提供生命，计入生命一行。克制和团队光环依赖敌我阵容，不重复加静态分。\n载重、生产速度、采速、资源产出等属性直接战力为 0，但支持持续补给。")
	elif id == "selectReserve": compare_unit=str(data)
	elif id == "coreRoute": _core_route_details()
	elif id.begins_with("coreChapter:"):
		selected_dungeon=int(data)*16
		for i in range(selected_dungeon,selected_dungeon+16):
			if not info.dungeonStatus[i].cleared:
				selected_dungeon=i
				break
	elif id.begins_with("chapter:"):
		selected_stage=int(data)*16
		for i in range(selected_stage,selected_stage+16):
			if not info.stageStatus[i].cleared:
				selected_stage=i
				break
	elif id in ["formationPower","formationTier"]:
		var mode="power" if id=="formationPower" else "tier"
		if screen=="deployment":
			draft=info.formationPlans[mode].duplicate(true)
			dirty=true
		else:
			request({"op":"autoFormation","mode":mode})
	elif id=="powerDetails": _power_details()
	elif id=="counterDetails": _counter_details()
	elif id=="leadAttempts": leadership_attempts={1:10,10:100,100:1}[leadership_attempts]
	elif id=="buyBooks":
		_confirm({"type":"buyBooks","count":leadership_attempts},"购买 %d 本统率书，共 %d 金币？\n单价 19 金币；购买不提升等级，使用时另行判定成功率。"%[leadership_attempts,leadership_attempts*19])
	elif id in ["trainBooks","trainGold"]:
		var payment="books" if id=="trainBooks" else "gold"
		_confirm({"type":"leadership","payment":payment,"attempts":leadership_attempts},"目标统率 Lv.%d；每次成功率 %.2f%%\n最多尝试 %d 次，成功即停，未使用部分不扣费。\n每次消耗 %s；失败不降级、无保底。\n最多花费 %s。"%[info.leadershipQuote.target,info.leadershipQuote.chance/100.0,leadership_attempts,"1 本统率书" if payment=="books" else "19 金币","%d 本书"%leadership_attempts if payment=="books" else "%d 金币"%(leadership_attempts*19)])
	elif id=="leadRules":
		_details("统率、声望与独立概率","统率上限 120，且不能超过声望等级。声望等级 = 1 + floor(sqrt(声望 / 40))，最高 120；旧档保留已有统率所需的最低声望等级，不增加声望点。\n\n升至 2—10 级为 100%；11 级 90%，之后按指数曲线降低，120 级为 0.1%。每次独立判定，失败不降级、不累积保底；相同失败次数不会改变下一次概率。\n\n每次尝试一本统率书，或直接 19 金币。最多 10 / 100 次是独立尝试的批次，成功立即停止，不保证成功。1/p 是平均次数，不是保证次数，连续 200 次失败也可能发生。\n\n战役每胜 1 本；核心第一至第五章每胜分别 1 / 2 / 3 / 4 / 5 本。每日补给、既有任务和 19 金币购书仍可使用。战役和核心胜利都获得声望。")
	elif id == "reportType":
		var options=["all","stage","dungeon","world","training"]
		report_type=options[(options.find(report_type)+1)%options.size()]
		report_page=0
	elif id == "reportResult":
		var options=["all","win","loss"]
		report_result=options[(options.find(report_result)+1)%3]
		report_page=0
	elif id == "reportRefresh":
		report_rows=s.reports.duplicate(true)
		report_page=0
	elif id == "budget" or id == "fullBudget":
		var plan={"op":"coreBudget","classId":CLASSES[selected_class],"tier":tier if id=="budget" else 7,"count":maxi(1,quantity) if id=="budget" else int(info.leadership)*6}
		if id=="budget" and selected_factory in ["factory","factory2"]: plan.factory=selected_factory
		request(plan)
	elif id == "challenge":
		for i in range(catalog.dungeons.size()):
			if catalog.dungeons[i].id==data: selected_dungeon=i
		campaign_mode="dungeon"
		_navigate("campaign")
	elif id == "presetRename":
		preset_index=int(data)
		_text_prompt("presetRename",s.presets[preset_index].name)
	elif id == "presetReplace" or id == "presetDelete":
		if id=="presetReplace" and dirty: toast_message("请先保存编队；覆盖使用当前已保存编队")
		else: _confirm({"type":id,"index":int(data)},("覆盖" if id=="presetReplace" else "删除")+"预设「"+s.presets[int(data)].name+"」？\n仅修改此预设，不影响战车库存或其他预设。")
	elif id == "tacticRules": _details("大回合、先手与连击", "每个大回合双方存活阵位各行动一次，按阵位顺序交替开火。一个小回合各取双方下一组；少阵位一方用尽后等待，另一方打完再开始下个大回合。已被击毁的待行动阵位跳过，不会额外获得行动。\n\n先手较高者先攻，同值我方先攻。连击紧接当前组，归属同一个小回合，不消耗或增加后续阵位的轮次。\n\n连击概率 = 10% +（我方二次开火值 − 敌方值）×0.1%，范围 0%—35%，最多追加一次。坦克逐列优先前排，整列为空则跳过；火炮按列内存活目标打一至两发，火箭固定六发；这些均是一次攻击内的连续射击。\n\n第50个大回合双方全部行动（含连击）结束后，若双方仍有部队，判先手方失败，不进入第51回合。\n\n团队数值取出战阵位平均，不随阵亡改变。旧战报继续使用原快照与旧轮转。")
	elif id == "scoutDetails": _navigate("intel")
	elif id == "intelText": _scout_details()
	elif id == "departurePlan":
		var site=_site()
		var q=info.marchQuotes[site.id]
		var load=0
		var count=0
		for st in draft:
			if st!=null:
				load+=st.count*info.unitStats[st.unitId].load
				count+=st.count
		var amount=mini(load,site.reserve)
		var gather=_effective_time(ceilf(amount*3600000.0/q.gatherRate)) if site.kind=="mine" else 0
		_details("本次出征计划","编队 %d 辆 · 运力 %s\n\n去程 %s / 返程 %s\n%s\n\n以上按当前编辑的编队估算；到达后战损、矿储变化会影响实际采集。突袭收益以交战结果为准，返城后入库。"%[count,_amount(load),_time(q.outboundMs),_time(q.returnMs),"预计采集 %s · 采速 %s / 时\n采集 %s · 预计归队 %s\n相当于同类自产 %.2f 小时（未扣战损）"%[_amount(amount),_amount(q.gatherRate),_time(gather),_time(q.outboundMs+q.returnMs+gather),float(amount)/maxf(1,q.localRate)] if site.kind=="mine" else "突袭无采集等待，预计往返 "+_time(q.outboundMs+q.returnMs)])
	elif id == "settingsAdvanced": settings_advanced = not settings_advanced
	elif id == "volumeDown" or id == "volumeUp":
		audio_volume = clampf(audio_volume + (-0.1 if id == "volumeDown" else 0.1), 0, 1)
		AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.001, audio_volume)))
		_save_preferences()
	elif id == "textScale":
		ui_scale = 1.1 if ui_scale < 1.05 else 1.2 if ui_scale < 1.15 else 1.0
		_save_preferences()
	elif id == "controls":
		_details("操作说明", "鼠标点击按钮；编队阵位可以拖动交换。\n\nTab / Shift+Tab：依次选择按钮；Enter：执行。\n1—8：主要页面；I：资源一览；F5：保存；F11：全屏。\n战斗空格：暂停 / 继续；N：查看下一次完整攻击。\n世界地图滚轮缩放、右键拖动；选择目标后可侦察与出征。\n\n休整推进整个世界时间，期间会发生战斗和损失。\nVIP 免费时长使非行军任务进入免费区间时自动完成。\n金币加速只完成选定订单，不推进世界时间。\n\n编队为待命库存的分配方案，不额外扣车。\n正式出征才预留部队；回城后幸存战车返回待命。")
	elif id == "battleStep": _step_action()
	elif id == "battleAdvanced": _details("高级战斗详情", "规则版本：" + report.ruleset + "\n随机种子：" + str(int(report.seed)) + "\n战报编号：" + report.id + "\n回放仅消费本场快照和事件，不重新模拟战斗。")
	elif id == "battleAdvice": _battle_advice()
	elif id == "lastProgress": screen = "restReport"
	elif id == "progressDetails": _progress_details()
	elif id == "reserveClass":
		var choices = ["all"] + CLASSES
		reserve_class = choices[(choices.find(reserve_class) + 1) % choices.size()]
		reserve_page = 0
	elif id == "reserveTier":
		reserve_tier = (reserve_tier + 1) % 8
		reserve_page = 0
	elif id == "reserveFilter":
		var choices = ["owned", "all", "damaged"]
		reserve_filter = choices[(choices.find(reserve_filter) + 1) % 3]
		reserve_page = 0
	elif id == "reserveSort": reserve_sort = not reserve_sort
	elif id == "formationCompare":
		compare_unit = str(data)
		_compare_details(compare_unit)
	elif id == "mapResource":
		var choices = ["all", "npc"] + RES.slice(0,5)
		map_resource = choices[(choices.find(map_resource) + 1) % choices.size()]
	elif id == "mapLevel": map_level = (map_level + 1) % 7
	elif id == "mapIntel":
		var choices = ["all","known","unknown","guarded"]
		map_intel = choices[(choices.find(map_intel) + 1) % 4]
	elif id == "expeditionHistory": _expedition_history()
	elif id == "worldPreset":
		if s.presets.is_empty():
			_navigate("army")
			toast_message("先在编队页保存“战斗”或“采集”预设")
		else:
			command({"type":"presetLoad","index":int(data)})
	elif id == "upgradeBenefits": _details("升级收益与解锁", _upgrade_benefits(str(data)))
	elif id == "refitCompare": _refit_details()
	elif id == "rematch":
		if _command_pending(): return true
		if report.mode == "world": _navigate("world")
		elif report.has("target"):
			campaign_mode="stage" if report.target.type=="battle" else "dungeon"
			if report.target.type=="battle": selected_stage=int(report.target.stage)
			else:
				for i in range(catalog.dungeons.size()):
					if catalog.dungeons[i].id==report.target.dungeonId: selected_dungeon=i
			command(report.target.duplicate(true))
		else:
			for i in range(catalog.stages.size()):
				if catalog.stages[i].name == report.title.trim_prefix("演习 · "):
					selected_stage = i
					command({"type":"battle","stage":i,"training":report.mode == "training"})
					return true
			for i in range(catalog.dungeons.size()):
				if report.title.trim_prefix("演习 · ").begins_with(catalog.dungeons[i].name) or (catalog.dungeons[i].get("legacyName","")!="" and report.title.trim_prefix("演习 · ").begins_with(catalog.dungeons[i].legacyName)):
					selected_dungeon = i
					command({"type":"dungeon","dungeonId":catalog.dungeons[i].id,"training":report.mode == "training"})
					return true
			_navigate("campaign")
	else: return false
	return true

func _missing_resources(cost, count = 1):
	var missing: Array[String] = []
	for r in RES:
		var shortage = int(cost.get(r, 0) * count - s.wallet[r])
		if shortage > 0: missing.append(catalog.resourceNames[r] + " " + _amount(shortage))
	return "缺少 " + " / ".join(missing) if not missing.is_empty() else ""

func _disabled_reason(id, data):
	if _command_pending(): return "操作正在提交，请稍候"
	if id=="repairAll": return "没有可维修车辆；永久损失不能恢复" if info.repairAll.count==0 else _missing_resources(info.repairAll.cost)
	if id=="dungeonAttack": return info.dungeonStatus[selected_dungeon].block
	if id in ["trainBooks","trainGold"]:
		if info.leadershipQuote.block!="": return info.leadershipQuote.block
		return "统率书缺少 %d 本；可用金币购买或挑战战役 / 核心副本"%maxi(0,leadership_attempts-int(s.commander.books)) if id=="trainBooks" else "金币还缺 %d"%maxi(0,leadership_attempts*19-int(s.wallet.gold))
	if id=="buyBooks": return "购买 %d 本书需 %d 金币，还缺 %d"%[leadership_attempts,leadership_attempts*19,maxi(0,leadership_attempts*19-int(s.wallet.gold))]
	if id in ["skill","initiativeSkill","extraFireSkill"]: return "技能上限120级；技能点来自战役首通，指挥中心21级起每日补给另加1点"
	if id=="budget": return "选择 VI 或 VII 阶战车可查看核心成本计划"
	if id == "produce":
		var q = _factory_quote()
		if q.block != "": return q.block
		if q.busy: return "本厂作业与等待位已满，请到调度中心查看"
		if quantity <= 0: return "请输入 1—100 的整数数量"
		if quantity > 100: return "制造或改装单批最多100辆，请分批提交"
		var missing = _missing_resources(q.unitCost, quantity)
		if missing != "": return missing
		if q.has("coreCost") and s.arsenal.cores[q.coreCost.id] < quantity:
			return "缺少 " + catalog.coreNames[q.coreCost.id] + " ×%d" % (quantity - s.arsenal.cores[q.coreCost.id])
		if q.sourceUnitId != "" and s.available[q.sourceUnitId] < quantity: return "原车不足，还需 %d 辆待命战车" % (quantity - s.available[q.sourceUnitId])
	elif id.begins_with("research:"):
		var q = info.researchQuotes[data]
		if q.block != "": return q.block
		if q.duplicate: return "此科技正在研究或已进入等待队列"
		if info.queues.research.full: return "科研队列已满，请到调度中心查看"
		return _missing_resources(q.unitCost)
	elif id == "upgrade":
		return info.blocks[selected_building] if info.blocks[selected_building] != "" else _missing_resources(info.buildingCosts[selected_building])
	elif id.begins_with("facilityUpgrade:"):
		var q = info.facilities[data].upgrade
		return q.block if q.block != "" else _missing_resources(q.unitCost)
	elif id == "repairStart":
		var q = info.unitStats[repair_unit].repair
		if q.busy: return "维修车间正在工作，请查看队列"
		if quantity<=0: return "暂无可修车辆" if s.damaged[repair_unit]==0 else "维修数量需为 1—%d 的整数"%s.damaged[repair_unit]
		if quantity>s.damaged[repair_unit]: return "待修仅 %d 辆，超出 %d；可点全部维修"%[s.damaged[repair_unit],quantity-s.damaged[repair_unit]]
		return _missing_resources(q.unitCost,quantity)
	elif id=="deploymentConfirm": return _deployment_problem()
	elif id=="scout": return "侦察需要 %s 水晶，还缺 %s；前往资源一览"%[_amount(info.marchQuotes[_site().id].scoutCost),_amount(maxi(0,info.marchQuotes[_site().id].scoutCost-int(s.wallet.crystal)))]
	elif id in ["gather","raid"]: return "远征队列已满，等待归队或前往 VIP 查看容量" if s.marches.size()>=info.vip.marches else "无可出征编队；先补齐待命车辆并保存编队"
	elif id.begins_with("assign:"): return "没有可分配的待命车辆；先制造，或减少其他阵位的同型车"
	return "当前条件未满足，请查看本页的等级、库存或队列说明"

func _disabled_help(id, data):
	var reason = _disabled_reason(id,data)
	toast_message(reason)
	if "科研中心" in reason or "指挥" in reason or "工厂" in reason and "队列" not in reason:
		selected_building = "lab" if "科研中心" in reason else "hq" if "指挥" in reason else "factory"
		_navigate("base")
	elif "队列" in reason or "等待位" in reason: _navigate("queues")
	elif "核心" in reason: _action("coreDungeons")
	elif "原车" in reason or "待命" in reason: _navigate("factory")
	elif "缺少" in reason: _navigate("inventory")
	elif "待修" in reason: _navigate("repair")

func _notify_progress(before, after):
	if before.is_empty() or before.get("id") != after.id: return
	var entries = after.notices.filter(func(n): return n.id > before.sequence)
	if not entries.is_empty():
		toast_message(entries[0].text + (" · 另有 %d 条动态" % (entries.size()-1) if entries.size()>1 else ""))
		completion_marks["queues"] = true
		completion_marks["inventory"] = true
		completion_marks["factory"] = true
	if not after.reports.is_empty() and (before.reports.is_empty() or after.reports[0].id!=before.reports[0].id): completion_marks["reports"] = true

func _draw_rest_report():
	_title("休整结算", "BASE OPERATIONS / AFTER REST")
	if progress_report.is_empty():
		_text("休整后将在这里汇总资源与作业结果。",Vector2(65,260),24)
		return
	_text("推进时间 " + _time(progress_report.elapsed) + " · 所有收益已自动结算",Vector2(45,224),22,GOLD)
	_panel(Rect2(40,249,740,469))
	_text("资源净入库（含自产与归队）",Vector2(62,285),23,TEXT,true)
	for i in range(6):
		var p = Vector2(67+(i%2)*350,321+int(i/2.0)*88)
		_icon(i,Rect2(p,Vector2(52,52)))
		_text(catalog.resourceNames[RES[i]],p+Vector2(70,21),19)
		_text(("+" if progress_report.resources[RES[i]]>=0 else "") + _amount(progress_report.resources[RES[i]]),p+Vector2(70,51),25,GOLD)
	_text("制造 %d 辆 · 改装 %d 辆 · 修复 %d 辆" % [progress_report.produced,progress_report.refitted,progress_report.repaired],Vector2(65,651),22,GREEN)
	var capped: Array[String]=[]
	for r in progress_report.get("capacityLimited",[]): capped.append(catalog.resourceNames[r])
	_text("满仓影响："+("、".join(capped) if not capped.is_empty() else "无"),Vector2(65,689),17,MUTED)
	_panel(Rect2(809,249,751,469))
	_text("建设 %d 项 · 研究 %d 项" % [progress_report.buildings.size(),progress_report.research.size()],Vector2(832,286),23,TEXT,true)
	var rows = []
	for item in progress_report.buildings: rows.append(catalog.buildingNames.get(item.id,info.facilities.get(item.id,{}).get("name",item.id)) + " → Lv.%d" % item.to)
	for item in progress_report.research: rows.append(catalog.techNames[item.id]+" → Lv.%d" % item.to)
	for i in range(mini(4,rows.size())): _fit_text(rows[i],Vector2(834,329+i*29),693,19,GREEN)
	if rows.is_empty():
		_text("这次没有建筑或科技升级完成",Vector2(834,333),19,MUTED)
		_text("生产交付见左侧；未完成作业继续计时。",Vector2(834,369),17,MUTED)
	if rows.size()>4: _text("另有 %d 项完成 · 查看完整记录"%(rows.size()-4),Vector2(834,448),16,GOLD)
	_text("远征结束 %d 队 · 新战报 %d 场" % [progress_report.returns.size(),progress_report.battles.size()],Vector2(834,483),22,GOLD)
	for i in range(mini(2,progress_report.returns.size())):
		var entry=progress_report.returns[i]
		var p=Vector2(832,498+i*61)
		_panel(Rect2(p,Vector2(704,56)),Color("192721"),LINE)
		_fit_text(entry.get("title",entry.targetId)+" · "+("已入库" if entry.outcome=="returned" else "部队全损")+" · 生还 %d"%entry.survivors,p+Vector2(12,23),680,17,TEXT)
		var losses=entry.get("losses")
		_fit_text(_cost_text(entry.cargo)+(" · 本次待修 %d / 永久损失 %d"%[losses.repairable,losses.destroyed] if losses!=null else " · 战损详见对应战报"),p+Vector2(12,46),680,15,GOLD)
		_hit("expeditionHistory",Rect2(p,Vector2(704,56)))
	if progress_report.returns.is_empty(): _text("本次休整没有远征归队",Vector2(834,530),18,MUTED)
	for i in range(mini(2,progress_report.battles.size())):
		var b = progress_report.battles[i]
		_button("reportSummary:"+b.id,("胜利 · " if b.winner==0 else "失利 · ")+b.title,Rect2(831,630+i*41,705,34),b.id)
	if progress_report.battles.is_empty(): _fit_text("归队卡中的战损为该次出征历史值；当前待修数量见维修车间。",Vector2(834,681),693,16,MUTED)
	_button("nav:inventory","查看入库",Rect2(40,755,270,48),"inventory")
	_button("nav:queues","作业队列",Rect2(332,755,270,48),"queues")
	_button("expeditionHistory","归队明细",Rect2(624,755,250,48))
	_button("progressDetails","完整记录",Rect2(892,755,250,48))
	_button("nav:base","返回基地",Rect2(1160,755,400,48),"base",true)

func _expedition_history():
	var lines: Array[String] = ["实际归队记录（新版本起保留最近 100 队）", ""]
	for entry in s.get("expeditionLog",[]):
		var site = {}
		for v in s.world:
			if v.id == entry.targetId: site = v
		lines.append("%s [%d,%d] · %s · 生还 %d" % [site.get("name",entry.targetId),site.get("x",0),site.get("y",0),"已入库" if entry.outcome=="returned" else "全损",entry.survivors])
		var battle_found = false
		for r in s.reports:
			if r.get("marchId","")==entry.marchId:
				var repairable = 0
				var destroyed = 0
				for loss in r.casualties:
					repairable += loss.repairable
					destroyed += loss.destroyed
				lines.append("本次战损：待修 %d / 永久损失 %d（为当时结算，不代表当前维修库存）" % [repairable,destroyed])
				battle_found = true
				break
		if not battle_found: lines.append("无对应战报：无战斗或战报已超出保留范围。")
		lines.append(_cost_text(entry.cargo) + "\n")
	_details("远征归队与入库", "\n".join(lines))

func _upgrade_benefits(id):
	var level = int(s.buildings.get(id, info.facilities.get(id,{}).get("level",0)))
	var full = level >= int(catalog.MAX_LEVEL)
	var lines: Array[String] = ["已达120级 · 当前能力" if full else "当前 Lv.%d → Lv.%d / 120" % [level,level+1]]
	if id in ["factory","factory2","refit"]:
		for u in catalog.unitList:
			if u.classId == "tank" and (id!="refit" or u.tier>1): lines.append("%d 级：解锁第 %d 阶四兵种%s" % [u.unlock.factoryLevel,u.tier,"（需要副本核心）" if u.tier>=6 else ""])
		var q=info.facilities[id].upgrade
		lines.append("本厂效率 +%.2f%% → +%.2f%%；1级0%%至120级100%%，连续提升可变工序效率，与科研和VIP加速相加。" % [q.speedPercent,q.nextSpeedPercent])
		lines.append("两座制造厂各一条工作线，改装厂独立；升级效率不增加并行工作线。任一制造工厂满足等级即可进入核心主线。")
		lines.append("改装需改装厂与至少一座制造厂同时满足目标兵阶等级。七阶60级开放；旧车辆与已支付订单保留。核心主线36 / 48 / 54 / 60级逐步开放，旧已通关关卡可重打。")
	elif id == "hq": lines.append("其他建筑可升至指挥中心等级，最高120；13级开放第二制造厂与改装厂，21级起每日补给额外1技能点。")
	elif id == "warehouse":
		var q=info.buildingBenefits[id]
		lines.append("每种资源自产容量 %s → %s，已计入科技与VIP。奖励和归队物资允许超过自产容量。" % [_amount(q.capacity),_amount(q.nextCapacity)])
	elif id == "lab": lines.append("允许科技研究至科研中心等级，最高120；所有前置依赖仍须满足。")
	else:
		var q=info.buildingBenefits[id]
		lines.append("本资源每小时产量 %s → %s，已计入当前经济科技。" % [_amount(q.rate),_amount(q.nextRate)])
	lines.append("1—120级统一设计产量、成本、时间与仓储。升级至101—120级时，实际工作时长按项目约12小时至5天；已计科技与VIP，旧订单保留原快照。")
	if full: lines.append("下一目标："+info.progression.next.title+"\n"+info.progression.next.condition)
	return "\n\n".join(lines)

func _refit_details():
	var q = _factory_quote()
	if q.sourceUnitId == "":
		toast_message("选择 II 阶以上战车后查看改装对比")
		return
	var a=info.unitStats[q.sourceUnitId]
	var b=info.unitStats[_unit_id()]
	_details("改装计划 · 原车 → 目标", "%s ×%d → %s ×%d\n\n单车攻击 %d → %d\n单车生命 %d → %d\n单车载重 %d → %d\n\n总资源：%s\n核心：%s\n预计完成：%s\n\n原车从待命库存投入，已出征和待修车辆不可改装；取消返还未完成部分。" % [catalog.units[q.sourceUnitId].name,quantity,catalog.units[_unit_id()].name,quantity,a.attack,b.attack,a.hp,b.hp,a.load,b.load,_cost_text(q.unitCost,quantity),catalog.coreNames[q.coreCost.id]+" ×%d"%quantity if q.has("coreCost") else "无需核心",_eta(q.waitMs+_effective_time(q.duration*quantity))])

func _battle_advice():
	var lines: Array[String] = []
	for hint in report.get("summary",{}).get("feedback",[]): lines.append(hint)
	lines.append("\n建议路线：调整编队 → 补兵 / 维修 → 军事科研 → 重新挑战。\n伤害明细以本场原始快照为准，不受当前科技改变影响。")
	_details("战后建议", "\n\n".join(lines))

func _step_action():
	if report.is_empty() or _battle_done(): return
	battle_paused = true
	var speed = battle_speed
	battle_speed = 1
	var action = last_hit if pending_hit else report.events[battle_index] if battle_index < report.events.size() else last_hit
	for i in range(1000):
		_battle_step(0.025)
		if not pending_hit and battle_index > 0 and (battle_index >= report.events.size() or not _same_turn(report.events[battle_index], action)): break
	if battle_index>=report.events.size() and not pending_hit: _battle_step(2)
	battle_speed = speed

func _same_turn(a,b):
	if report.get("ruleset","") in ["classic-combat-v0.14","classic-combat-v0.20","classic-combat-v0.22","classic-combat-v0.24.3"] and a.has("exchange") and b.has("exchange"):
		return a.round==b.round and a.exchange==b.exchange and a.side==b.side and a.from==b.from
	return _same_battle_action(a,b)


func _reserve_entries():
	var entries = catalog.unitList.filter(func(u):
		var matching_stock = reserve_filter == "all" or (reserve_filter == "owned" and s.available[u.unitId] > 0) or (reserve_filter == "damaged" and s.damaged[u.unitId] > 0)
		return (reserve_class == "all" or u.classId == reserve_class) and (reserve_tier == 0 or u.tier == reserve_tier) and matching_stock)
	if reserve_sort: entries.sort_custom(func(a,b): return s.available[a.unitId]>s.available[b.unitId])
	return entries

func _pattern_name(cls):
	return {"tank":"逐列前排优先 · 1—3发","tank_destroyer":"对列首个目标","spg":"对列一至两发","rocket":"六阵位固定六发"}[cls]

func _counter_label(cls):
	var names: Array[String] = []
	for row in catalog.rules.matchup:
		if row.attackerClass == cls and row.multiplierBps > 10000: names.append(catalog.classNames[row.defenderClass]+" +%d%%"%int((row.multiplierBps-10000)/100))
	return "克制 " + "/".join(names) if not names.is_empty() else "群体覆盖"

func _draw_replacement(rect):
	_panel(rect,Color("17251f"),LINE)
	var a=draft[selected_slot]
	var candidate=compare_unit if compare_unit!="" else (a.unitId if a!=null else "tank_t1")
	var st=info.unitStats[candidate]
	var n=mini(info.leadership,_free_for_slot(candidate))
	var old_hp=0 if a==null else info.unitStats[a.unitId].hp*a.count
	var old_attack=0 if a==null else info.unitStats[a.unitId].attack*a.count
	var selecting=compare_unit==""
	_fit_text("阵位 %d · 当前配置"%[selected_slot+1] if selecting else "替换预览 · 数量 %d → %d"%[0 if a==null else a.count,n],rect.position+Vector2(16,30),580,21,GOLD,true)
	_fit_text((catalog.units[a.unitId].name+" ×%d"%a.count if a!=null else "空阵位 · 从上方库存选择车辆") if selecting else (catalog.units[a.unitId].name if a!=null else "空阵位")+" → "+catalog.units[candidate].name,rect.position+Vector2(16,63),580,18,TEXT)
	_fit_text("总生命 "+_amount(old_hp)+" · 火力 "+_amount(old_attack) if selecting else "总生命 %s → %s (%s%s)"%[_amount(old_hp),_amount(st.hp*n),"+" if st.hp*n>=old_hp else "",_amount(st.hp*n-old_hp)],rect.position+Vector2(16,94),580,18,GREEN)
	_fit_text("选中候选车后预览变化；部署后仍可调整数量。" if selecting else "当前加成火力 %s → %s · 载重 %s"%[_amount(old_attack),_amount(st.attack*n),_amount(st.load*n)],rect.position+Vector2(16,121),580,18,GOLD)
	_fit_text(_pattern_name(catalog.units[candidate].classId)+" · "+_counter_label(catalog.units[candidate].classId)+(" · 承伤" if catalog.units[candidate].classId=="tank" else " · 后排保护火力"),rect.position+Vector2(16,149),580,15,MUTED)
	_button("assign:"+candidate,"请先选择车辆" if selecting and a==null else "部署 %d 辆"%n,Rect2(rect.position+Vector2(16,161),Vector2(180,34)),candidate,true,n>0 and (not selecting or a!=null))
	_button("formationCompare","属性与库存",Rect2(rect.position+Vector2(207,161),Vector2(182,34)),candidate)
	_button("nav:doctrine","攻击图解",Rect2(rect.position+Vector2(401,161),Vector2(198,34)),"doctrine")

func _compare_details(id):
	var lines: Array[String] = [catalog.units[id].name + " · " + _pattern_name(catalog.units[id].classId), "已包含科技和指挥官技能，实战还受数量、克制和光环影响。", ""]
	var st=info.unitStats[id]
	var base=catalog.units[id]
	lines.append("基础：攻击 %d / 生命 %d / 单机运输载重 %d"%[base.attack,base.hp,st.baseLoad])
	lines.append("当前加成：攻击科技 +%d%%，指挥官攻击 +%d%%；生命 +%d%%；运输科技 ×%.2f"%[s.tech.attack*5,s.commander.attackSkill*2,s.tech.hp*5+s.tech.armorPlating*3,st.load/float(st.baseLoad)])
	lines.append("历史属性只在对应战报快照内查看；本页为当前有效属性。")
	lines.append("前排适配：%s；后排适配：保护主炮输出，仍受纵列 / 全体攻击"%["高生命承伤" if base.classId=="tank" else "注意较低生命与敌方克制"])
	lines.append("单车攻击 %d / 生命 %d / 载重 %d\n先手 %d / 二次开火 %d"%[st.attack,st.hp,st.load,st.initiative,st.extraFire])
	for item in info.inventory:
		if item.id==id:
			var assigned=0
			for slot in draft:
				if slot!=null and slot.unitId==id: assigned+=slot.count
			lines.append("\n现存总量 %d；其中待命 %d（当前编队拟使用 %d）、出征 %d、维修中 %d、待修 %d、改装投入 %d。\n生产中的新车 %d 未计入现存总量。"%[item.quantity,item.available,assigned,item.marching,item.repairing,item.damaged,item.refitting,item.producing])
	for row in catalog.rules.matchup:
		if row.attackerClass==catalog.units[id].classId: lines.append("对 "+catalog.classNames[row.defenderClass]+" ×%.2f"%(row.multiplierBps/10000.0))
	_details("编队装备档案", "\n".join(lines))

func _draw_doctrine():
	_title("六格攻击图解", "FIELD MANUAL / TARGET SELECTION")
	_text("前排 1/2/3，后排 4/5/6。示例：我方阵位 2（或5），正对敌方第2列。",Vector2(43,215),22,GOLD)
	for c in range(4):
		var p=Vector2(40+c*385,244)
		_panel(Rect2(p,Vector2(365,482)),Color("14211d"),LINE)
		_text(catalog.classNames[CLASSES[c]],p+Vector2(20,38),27,TEXT,true)
		_text(_pattern_name(CLASSES[c]),p+Vector2(20,73),21,GOLD)
		for mode in range(3 if c==0 else 2):
			var row_y=105+mode*108 if c==0 else 115+mode*175
			var occupied=[[1,2,3,4,5,6],[1,3,5],[1,3,4,6]][mode] if c==0 else ([1,2,3,4,5,6] if mode==0 else [4,5,6])
			var targets=[[1,2,3],[1,5,3],[1,3]][mode] if c==0 else ([[1,2,3],[2],[2,5],[1,2,3,4,5,6]][c] if mode==0 else [[4,5,6],[5],[5],[1,2,3,4,5,6]][c])
			_text(["三列有车 · 3发","前1/3、后5 · 3发","第2列全空 · 2发"][mode] if c==0 else ("前排完整" if mode==0 else "前排清空 → 转向后排"),p+Vector2(20,row_y),17,MUTED)
			for slot in range(1,7):
				var q=p+Vector2(25+(slot-1)%3*107,row_y+12+int((slot-1)/3.0)*(31 if c==0 else 51))
				_panel(Rect2(q,Vector2(92,28 if c==0 else 42)),Color("526043") if slot in targets else Color("182420"),GOLD if slot in targets else LINE)
				_text(str(slot) if slot in occupied else "空",q+Vector2(33,21 if c==0 else 28),18 if c==0 else 20,TEXT if slot in targets else MUTED)
		if c==0: _text("每列一发，最多3发，不打地面",p+Vector2(20,411),16,GOLD)
		_text(_counter_label(CLASSES[c]),p+Vector2(20,442),18,GREEN)
		var weak: Array[String]=[]
		for row in catalog.rules.matchup:
			if row.attackerClass==CLASSES[c] and row.multiplierBps<10000: weak.append("对"+catalog.classNames[row.defenderClass]+" %d%%"%int((row.multiplierBps-10000)/100))
		_text("；".join(weak) if not weak.is_empty() else "其余关系：基础伤害",p+Vector2(20,470),16,MUTED)
	_text("坦克每列只打一组，整列空则跳过；仅火箭固定6发，空位打地面。火炮/歼击车整列空才转邻列。",Vector2(43,765),20,TEXT)
	_button("nav:army","返回编队",Rect2(1250,774,310,46),"deployment" if not deployment.is_empty() else "army",true)
	_button("counterDetails","查看完整倍率 / 团队光环",Rect2(40,794,550,32))

func _begin_world_deployment(mission):
	var target=_site()
	var intel=s.intel.get(target.id)
	deployment_backup={"draft":draft.duplicate(true),"dirty":dirty}
	deployment={"command":{"type":"march","targetId":target.id,"mission":mission,"training":false},"title":target.name+" [%d,%d]"%[target.x,target.y],"enemy":intel.guards.duplicate(true) if intel!=null else [null,null,null,null,null,null],"unknown":intel==null,"stale":intel!=null and s.now-intel.at>=info.worldInterval}
	deployment.guardTech=int(target.level/2) if intel!=null and target.get("economyVersion",0)>=2 else 0
	draft=info.usable.duplicate(true)
	dirty=true
	deployment_retry={}
	deployment_enemy=false
	reserve_page=0
	screen="deployment"

func _map_matches(site):
	if map_resource=="npc" and site.kind!="npc": return false
	if map_resource not in ["all","npc"] and (site.kind!="mine" or site.resource!=map_resource): return false
	if map_level>0 and (site.level<1+(map_level-1)*20 or site.level>map_level*20): return false
	var intel=s.intel.get(site.id)
	if map_intel=="known" and intel==null: return false
	if map_intel=="unknown" and intel!=null: return false
	if map_intel=="guarded" and (intel==null or not intel.guards.any(func(st): return st!=null and st.count>0)): return false
	return true

func _battle_environment():
	var title = report.get("title", "")
	if report.get("target",{}).get("type","")=="dungeon":
		for d in catalog.dungeons:
			if d.id==report.target.dungeonId: return "ground_"+d.theme
	if report.get("mode") == "dungeon" or "试验" in title or "试炼" in title or "核心" in title: return "ground_proving"
	if "油" in title: return "ground_oilfield"
	if "堡" in title or "防线" in title or "阵地" in title or "封锁" in title: return "ground_fortress"
	if "基地" in title or "钢铁" in title or "装甲集群" in title: return "ground_industrial"
	return "battle_terrain"

func _draw_environment_border():
	var env=_battle_environment()
	for i in range(18):
		var alpha=0.24*(1.0-i/18.0)
		draw_rect(Rect2(i*2,89,2,750),Color(0.02,0.04,0.03,alpha))
		draw_rect(Rect2(1598-i*2,89,2,750),Color(0.02,0.04,0.03,alpha))
	if env!="battle_terrain":
		for side in range(2):
			var x=0 if side==0 else 1588
			draw_rect(Rect2(x,89,12,749),Color("26302c"))
			for i in range(16): draw_line(Vector2(x,100+i*48),Vector2(x+12,112+i*48),GOLD.darkened(0.5),5)
		var title={"ground_industrial":"工业基地", "ground_oilfield":"油田地带", "ground_fortress":"要塞防区", "ground_proving":"装甲试验场"}[env]
		_panel(Rect2(1325,99,242,40),Color("1b2721"),LINE)
		_text(title,Vector2(1344,126),18,GOLD)

func _v12_qa(out):
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v11-save.json"))})
	await _settled()
	# Independent popup scroll state, including reused AcceptDialog layout.
	var long_text="摘要\n"+"军事说明行\n".repeat(100)
	_details("甲",long_text)
	await get_tree().process_frame
	details_text.scroll_vertical=45
	await get_tree().process_frame
	_details("乙","新内容摘要\n短说明")
	await get_tree().process_frame
	await get_tree().process_frame
	if details_text.scroll_vertical!=0:
		print("V12_FAILED: popup scroll leak")
		return false
	_details("甲",long_text)
	await get_tree().process_frame
	await get_tree().process_frame
	if details_text.scroll_vertical<30:
		print("V12_FAILED: content scroll not restored")
		return false
	details_dialog.hide()
	reserve_class="spg"
	reserve_tier=7
	reserve_filter="all"
	if _reserve_entries().size()!=1 or _reserve_entries()[0].unitId!="spg_t7": return false
	reserve_class="all"
	reserve_tier=0
	reserve_filter="owned"
	draft=info.suggestedFormation.duplicate(true)
	dirty=true
	compare_unit="tank_t7"
	var snapshot=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("v12-battle.json")))
	open_report(snapshot)
	battle_paused=true
	_step_action()
	if not battle_paused or battle_index<=0 or pending_hit:
		print("V12_FAILED: next action boundary")
		return false
	var first_id=last_hit.get("action",0)
	if battle_index<report.events.size() and report.events[battle_index].get("action",-1)==first_id: return false
	var original_size=get_window().size
	var sizes=[Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]
	var captures=[]
	for size in sizes:
		get_window().size=size
		await get_tree().create_timer(0.15).timeout
		var suffix="%dx%d"%[size.x,size.y]
		for page in ["army","world","research","settings","inventory"]:
			screen=page
			if page=="inventory": inventory_category="cores"
			await _qa_capture(out,"v12-"+page+"-"+suffix)
			size=get_window().size
			captures.append({"page":page,"window":[size.x,size.y]})
		open_report(snapshot)
		battle_paused=true
		_step_action()
		await _qa_capture(out,"v12-battle-"+suffix)
		for side in range(2):
			for st in battle_armies[side]:
				if st.totalHp<=0: continue
				var pose=_battle_pose(st.unitId,side,st.slot)
				var meta=battle_sprite_meta[pose.texture]
				var bounds=Rect2(pose.position-pose.pivot*pose.scale,Vector2(meta.rect[2],meta.rect[3])*pose.scale)
				if not Rect2(0,89,1600,750).encloses(bounds):
					print("V12_FAILED: vehicle outside battlefield",bounds)
					return false
		for rect in battle_labels:
			if not Rect2(0,89,1600,750).encloses(rect):
				print("V12_FAILED: label outside battlefield",rect)
				return false
		for i in range(battle_labels.size()):
			for j in range(i):
				if battle_labels[i].intersects(battle_labels[j]):
					print("V12_FAILED: labels overlap")
					return false
		_action("battleSkip")
		await _qa_capture(out,"v12-settlement-"+suffix)
	get_window().size=Vector2i(1280,720)
	ui_scale=1.1
	screen="army"
	await _qa_capture(out,"v12-large-type")
	ui_scale=1.0
	_details("野战指挥台 / 操作说明","Tab 选择 · Enter 执行\n\n不同文档保留独立阅读位置。\n\n所有入库变化自动同步，不需要重新打开页面。")
	await _qa_capture(out,"v12-themed-dialog")
	details_dialog.hide()
	screen="factory"
	production_mode="refit"
	tier=7
	selected_class=0
	_set_quantity(10)
	await _qa_capture(out,"v12-refit-comparison")
	production_mode="produce"
	tier=1
	screen="settings"
	settings_advanced=true
	await _qa_capture(out,"v12-advanced-settings")
	settings_advanced=false
	screen="doctrine"
	await _qa_capture(out,"v12-attack-patterns")
	for title in ["装甲集群","燃烧油田","钢铁堡垒","装甲试验场"]:
		open_report(snapshot.duplicate(true))
		report.title=title
		battle_paused=true
		_battle_step(2)
		await _qa_capture(out,"v12-scene-"+_battle_environment())
	# Unknown world intel stays unknown at preflight, then cancelling restores the draft.
	_navigate("world")
	selected_site=s.world[0].id
	_begin_world_deployment("gather" if _site().kind=="mine" else "raid")
	if not deployment.unknown or deployment.enemy.any(func(st):return st!=null): return false
	deployment_enemy=true
	await _qa_capture(out,"v12-world-unknown")
	_action("deploymentCancel")
	if screen!="world": return false
	_begin_deployment({"type":"battle","stage":11,"training":false})
	deployment_enemy=true
	await _qa_capture(out,"v12-known-enemy")
	_action("deploymentCancel")
	# Production completes while the factory remains open; derived views share the response.
	screen="factory"
	var before=s.available.tank_t1
	command({"type":"produce","unitId":"tank_t1","count":2})
	await _settled()
	command({"type":"rest","minutes":60})
	await _settled()
	if progress_report.is_empty() or s.available.tank_t1!=before+2: return false
	for item in info.inventory:
		if item.id=="tank_t1" and item.available!=s.available.tank_t1: return false
	await _qa_capture(out,"v12-rest-report")
	get_window().size=original_size
	FileAccess.open(out.path_join("v12-regression.json"),FileAccess.WRITE).store_string(JSON.stringify({"scroll_isolation":"pass","filters":"pass","next_complete_action":"pass","world_unknown_cancel":"pass","stock_projection_sync":"pass","rest_summary":"pass","label_bounds_overlap":"pass","captures":captures},"  "))
	return true

func _progress_details():
	var lines: Array[String] = ["休整 "+_time(progress_report.elapsed),"资源净变化："]
	for r in RES: lines.append(catalog.resourceNames[r]+" %+d"%progress_report.resources[r])
	lines.append("\n制造 %d / 改装 %d / 修复 %d"%[progress_report.produced,progress_report.refitted,progress_report.repaired])
	for item in progress_report.buildings: lines.append(catalog.buildingNames.get(item.id,info.facilities.get(item.id,{}).get("name",item.id))+" %d → %d"%[item.from,item.to])
	for item in progress_report.research: lines.append(catalog.techNames[item.id]+" %d → %d"%[item.from,item.to])
	for entry in progress_report.returns: lines.append("\n"+entry.marchId+" · 生还 %d · "%entry.survivors+_cost_text(entry.cargo))
	lines.append("\n实际自产入库："+_cost_text(progress_report.get("generated",{})))
	for b in progress_report.battles: lines.append(("胜利 · " if b.winner==0 else "失利 · ")+b.title+" · 待修 %d / 永损 %d"%[b.get("repairable",0),b.get("destroyed",0)])
	_details("完整休整记录","\n".join(lines))

func _filtered_reports():
	var rows=[]
	for saved in report_rows:
		var r=saved
		for current in s.reports:
			if current.id==saved.id:
				r=current
				break
		if report_type!="all" and r.mode!=report_type: continue
		if report_result=="win" and r.winner!=0: continue
		if report_result=="loss" and r.winner==0: continue
		rows.append(r)
	return rows

func _rest_preview_text():
	var p=rest_preview
	var limits: Array[String]=[]
	for r in p.capacityLimited: limits.append(catalog.resourceNames[r])
	var income: Array[String]=[]
	for r in RES:
		if p.generated.get(r,0)>0: income.append(catalog.resourceNames[r]+" "+_amount(p.generated[r]))
	var income_text="，".join(income.slice(0,3)) if not income.is_empty() else "0"
	if income.size()>3: income_text+="\n"+"，".join(income.slice(3))
	return "休整 %d 小时？\n\n预计完成：建设 %d 项 / 科研 %d 项\n制造 %d 辆 / 改装 %d 辆 / 维修 %d 辆\n预计自产入库：%s\n满仓限制：%s\n在途 %d 队，仍按规则交战、采集和返城。\n\n%s"%[int(p.minutes/60),p.buildings.size(),p.research.size(),p.produced,p.refitted,p.repaired,income_text,"、".join(limits) if not limits.is_empty() else "无",p.expeditions.size(),p.note.replace("；","；\n").replace("。确认","。\n确认")]

func _show_core_budget(p):
	var lines: Array[String]=[catalog.units[p.unitId].name+" ×%d 新造 / 改装计划"%p.count,"核心：持有 %d / 需要 %d / 缺少 %d"%[p.owned,p.count,p.needed],"来源："+p.dungeonName,"首通 %d；重复 %d—%d，随机等概率整数。"%[p.drop.first,p.drop.min,p.drop.max],"按均值估算约 %d 场；最快 %d 场；%s。"%[p.victories,p.victoriesMin,"最慢无有限保证" if p.victoriesMax==null else "最慢 %d 场"%p.victoriesMax],p.dungeonBlock,"不计前置关卡、失败补兵、战损与后续等级变化；均值估算不是保证次数。"]
	for kind in ["manufacture","refit"]:
		var q=p[kind]
		lines.append("\n"+("制造新车" if kind=="manufacture" else "原车改装")+" · "+info.facilities[q.facility].name)
		lines.append("资源："+_cost_text(q.cost))
		lines.append("本批工作时间："+_eta(_effective_time(q.duration))+"（不含队列等待）")
		if q.source!="": lines.append("原车：%s ×%d，缺少 %d；需另行补齐，未计入上述成本。"%[catalog.units[q.source].name,q.sourceCount,q.sourceShortage])
		if q.block!="": lines.append(q.block)
	lines.append("\n优先计算当前已开放的最高产出同车系关卡。可在工厂切换车系、阶级和数量后重新查看。")
	_details("高阶成长成本", "\n".join(lines))

func _draw_objectives():
	_title("成长计划与精英荣誉","PROGRESSION / FIELD OBJECTIVES")
	for i in range(info.progression.cards.size()):
		var c=info.progression.cards[i]
		var p=Vector2(40+(i%2)*492,211+int(i/2.0)*169)
		_panel(Rect2(p,Vector2(473,153)),Color("17251f"),GREEN if c.current>=c.total else LINE)
		_text(c.title,p+Vector2(18,32),23,TEXT,true)
		_text("%d / %d"%[c.current,c.total]+(" · 完成" if c.current>=c.total else " · 进行中"),p+Vector2(18,65),20,GOLD)
		_text(c.purpose,p+Vector2(18,95),16,MUTED)
		_button("nav:goal"+c.id,"前往"+{"campaign":"战役 / 副本","industry":"工业区","army":"编队","research":"科研"}[c.page],Rect2(p+Vector2(18,109),Vector2(436,32)),c.page)
	for i in range(info.progression.honors.size()):
		var h=info.progression.honors[i]
		var p=Vector2(1040,211+i*101)
		_panel(Rect2(p,Vector2(520,91)),Color("17251f"),GREEN if h.done else LINE)
		_text(h.title,p+Vector2(15,28),22,GREEN if h.done else GOLD,true)
		_text("已记录永久荣誉" if h.done else "正式精英胜利 · "+("损失 ≤5%" if h.id=="low-loss" else "只使用指定车系"),p+Vector2(15,57),15,MUTED)
		_button("challenge","查看挑战",Rect2(p+Vector2(352,51),Vector2(151,28)),h.dungeonId)
	_text("荣誉随存档保存；挑战使用现有副本，奖励沿用首胜 / 重复规则，不额外发放物资。",Vector2(43,757),18,MUTED)
	_button("fullBudget","当前车系 · 六格 VII 阶成本计划",Rect2(40,781,580,42),null,true)
	_button("nav:factory","前往制造 / 切换计划车系",Rect2(650,781,490,42),"factory")
	_button("nav:base","返回基地",Rect2(1170,781,390,42),"base")

func _draw_presets():
	_title("编队预设管理","FORMATION / SAVED PLANS")
	_text("最多 5 个；新建保存已保存编队，加载不扣兵，覆盖和删除需要确认。",Vector2(43,215),19,GOLD)
	for i in range(s.presets.size()):
		var p=Vector2(40,239+i*104)
		_panel(Rect2(p,Vector2(1520,91)))
		_text(s.presets[i].name,p+Vector2(20,34),24,TEXT,true)
		var count=0
		var occupied=0
		for st in s.presets[i].formation:
			if st!=null:
				count+=st.count
				occupied+=1
		_text("%d 辆 · %d / 6 阵位；加载时校验当前库存"%[count,occupied],p+Vector2(20,67),17,MUTED)
		for j in range(4):
			_button("presetLoad:"+str(i) if j==0 else ["","presetRename","presetReplace","presetDelete"][j],["加载","重命名","覆盖","删除"][j],Rect2(p+Vector2(730+j*194,24),Vector2(180,43)),i,j==0)
	_button("presetSave","新建预设",Rect2(40,783,380,42))
	_button("nav:army","返回编队",Rect2(1190,783,370,42),"army",true)

func _draw_intel():
	var site=_site()
	var intel=s.intel.get(site.id)
	var stale=intel!=null and s.now-intel.at>=info.worldInterval
	_title("侦察档案 · "+site.name,"FIELD INTELLIGENCE / SIX POSITIONS")
	_button("nav:world","返回地图",Rect2(1350,118,210,45),"world")
	_panel(Rect2(40,199,1520,63),Color("2c231b") if stale else Color("17261f"),GOLD if stale else LINE)
	var status="未知 · 先侦察才能判断守军，未知不代表空阵" if intel==null else ("情报已过期 · 建议重新侦察" if stale else "已侦察 · 以下为当时守军快照")
	_fit_text(status,Vector2(61,226),1060,21,GOLD if stale or intel==null else GREEN,true)
	var age="尚无侦察记录" if intel==null else "采集于 "+_time(s.now-intel.at)+" 前"
	_text("坐标 [%d,%d] · 地区 Lv.%d · "%[site.x,site.y,site.level]+age,Vector2(62,250),16,MUTED)
	var q=info.marchQuotes[site.id]
	_button("scout",("重新侦察" if intel!=null else "侦察")+" · %s 水晶"%_amount(q.scoutCost),Rect2(1190,211,349,39),null,true,s.wallet.crystal>=q.scoutCost and not _command_pending())
	var stats=info.knownGuardStats.get(site.id,[])
	for i in range(6):
		var p=Vector2(40+(i%3)*514,284+int(i/3.0)*225)
		_panel(Rect2(p,Vector2(492,207)),Color("17201f"),LINE)
		_text("%02d · %s"%[i+1,"前排" if i<3 else "后排"],p+Vector2(16,30),18,GOLD,true)
		var unit=null if intel==null else intel.guards[i]
		if unit==null:
			_text("?" if intel==null else "—",p+Vector2(215,104),38,MUTED)
			_text("兵种与数量未知" if intel==null else "侦察时无驻守部队",p+Vector2(141,151),20,MUTED)
			continue
		var u=catalog.units[unit.unitId]
		_fit_text(u.name,p+Vector2(136,32),338,23,TEXT,true)
		_image(unit.unitId,Rect2(p+Vector2(12,44),Vector2(129,99)))
		_text("×%d 辆 · 第%d阶"%[unit.count,u.tier],p+Vector2(155,65),22,GOLD,true)
		var matched=stats.filter(func(st):return st.slot==i+1)
		if not matched.is_empty():
			var st=matched[0]
			_fit_text("实际攻击 %s · 单车生命 %s"%[_amount(int(st.attack*st.attackBonus/10000)),_amount(st.hp)],p+Vector2(155,95),320,17,TEXT)
			_fit_text("先手 %d · 二次开火 %d"%[st.initiative,st.extraFire],p+Vector2(155,124),320,17,TEXT)
		_fit_text(_pattern_name(u.classId),p+Vector2(17,166),461,17,GOLD)
		_fit_text(_counter_label(u.classId),p+Vector2(17,193),461,16,MUTED)
	_fit_text("地区守军科技 %d 级 · 克制、光环与实际出战数量共同影响战果"%int(site.level/2) if intel!=null and site.get("economyVersion",0)>=2 else "侦察档案只展示已获得的情报；敌军可能在之后恢复或发生变化。",Vector2(45,757),1505,17,MUTED)
	_button("intelText","完整属性档案",Rect2(40,786,270,42))
	_button("nav:army","调整下一队编队",Rect2(330,786,350,42),"army")
	_button("gather" if site.kind=="mine" else "raid","检查编队并出征",Rect2(1130,786,430,42),null,true,s.marches.size()<info.vip.marches and q.load>0 and not _command_pending())

func _scout_details():
	var intel=s.intel.get(selected_site)
	if intel==null:
		_details("侦察档案","守军未知。先侦察才能查看阵位与兵种；未知不等于无守军。")
		return
	var lines: Array[String]=["情报已过期，建议重新侦察。" if s.now-intel.at>=info.worldInterval else "已侦察；仅代表当时状态。",_site().name+" · "+_time(s.now-intel.at)+" 前"]
	if _site().get("economyVersion",0)>=2: lines.append("地区 Lv.%d · 守军攻击/装甲/弹道/机动科技 %d 级"%[_site().level,int(_site().level/2)])
	for i in range(6):
		var st=intel.guards[i]
		lines.append("阵位 %d：%s"%[i+1,"空阵位" if st==null else catalog.units[st.unitId].name+" ×%d"%st.count])
		for actual in info.knownGuardStats.get(selected_site,[]):
			if actual.slot==i+1: lines.append("攻击 %s · 单车生命 %s · 先手 %d · 二次开火 %d"%[QuantityFormat.exact(int(actual.attack*actual.attackBonus/10000)),QuantityFormat.exact(actual.hp),actual.initiative,actual.extraFire])
	_details("守军侦察档案","\n\n".join(lines))

func _formation_power(f, player_side):
	var total=0
	for st in f:
		if st!=null: total+=st.count*(info.power.units[st.unitId] if player_side else info.power.base[st.unitId])
	return int(total)

func _power_details():
	_details("战力计算与统计口径","当前出战编队：%d\n当前库存最大可编战力：%d\n当前成长条件六格满编上限：%d\n\n上限 = 当前已解锁或曾获得车型的最高单车战力 × 单格统率上限 × 6。不要求现在拥有足够车辆或核心，不预支尚未研究的科技。库存方案只用当前待命车辆，维修和出征车辆不可重复使用。\n\n同阶四车系白板单车使用相同基准分；伤害覆盖 × 命中 × 暴击 × 有效生命构成能力，按该车系自身白板归一化，再乘先手与连击增幅。装甲按当前战斗规则代表抗暴；装甲加固科技提供的生命也计入。攻击、生命、弹道、机动科技，以及指挥官攻击 / 先手 / 连击技能都影响战力。\n\n战力为战略比较指标，不是伤害或胜率。克制、目标数量、前后排与条件光环不强行折算成必胜分。历史战斗属性仍以该场快照为准。"%[_formation_power(draft,true),info.power.readyMax,info.power.ceiling])

func _counter_details():
	var lines: Array[String]=["伤害倍率：每次命中按攻击者 → 目标车系计算，与兵阶无关。"]
	for cls in CLASSES:
		lines.append("\n"+catalog.classNames[cls])
		for row in catalog.rules.matchup:
			if row.attackerClass==cls: lines.append("对 "+catalog.classNames[row.defenderClass]+"：%.2f 倍（%+d%%）"%[row.multiplierBps/10000.0,int((row.multiplierBps-10000)/100)])
	lines.append("\n团队光环每车系只取一次，存在存活该车系才生效：\n坦克：全队攻击 +5%；歼击车：全队暴击率 +5 个百分点；\n自行火炮：受到穿甲伤害 −10%；火箭车：受到火箭伤害 −10%。\n倍率与光环乘算；伤害还受科技、指挥官、暴击、命中和存活数量影响。")
	_details("兵种克制与光环", "\n".join(lines))

func _draw_command_training():
	_title("统率与战术指挥","OFFICER ACADEMY / COMMAND & TACTICS")
	var q=info.leadershipQuote
	_panel(Rect2(40,203,745,539),Color("15231e"),GOLD.darkened(0.5))
	_text("统率 Lv.%d / 120"%s.commander.leadership,Vector2(66,249),31,TEXT,true)
	_text("单格 %d 辆 · 六格 %d 辆"%[info.leadership,info.leadership*6],Vector2(66,285),21,GOLD)
	_text("声望 Lv.%d · 统率不得超过声望等级"%info.prestigeLevel,Vector2(66,323),20,TEXT)
	_text("下一等级 %d · 每次成功率 %.2f%%"%[mini(120,q.target),q.chance/100.0] if q.target<=120 else "统率已满级",Vector2(66,367),25,GOLD,true)
	_text("平均约 %.1f 次 / %.0f 金币（非保底次数）"%[q.expectedAttempts,q.expectedAttempts*19],Vector2(66,406),18,MUTED)
	_button("leadAttempts","最多尝试 %d 次 · 点击切换"%leadership_attempts,Rect2(66,438,690,41))
	var ready=q.block=="" and not _command_pending()
	_button("trainBooks","用书尝试 · 最多 %d 本"%leadership_attempts,Rect2(66,499,335,47),null,true,ready and s.commander.books>=leadership_attempts)
	_button("trainGold","金币尝试 · 最多 %d"%(leadership_attempts*19),Rect2(416,499,340,47),null,false,ready and s.wallet.gold>=leadership_attempts*19)
	_text("现有书籍 %d · 每次一本或 19 金币"%s.commander.books,Vector2(66,581),20,TEXT)
	var block_text=q.block if q.block!="" else "失败不降级；独立判定，成功后立即停止。"
	_text(block_text.substr(0,31),Vector2(66,615),17,RED if q.block!="" else GREEN)
	if block_text.length()>31: _text(block_text.substr(31),Vector2(66,637),17,RED)
	if s.has("lastLeadership"):
		var last=s.lastLeadership
		_text("上次：目标 %d · 尝试 %d 次 · %s"%[last.target,last.attempts,"成功" if last.success else "未成功"],Vector2(66,659),20,GOLD)
	_button("leadRules","升级概率 / 声望 / 书籍来源",Rect2(66,689,690,35))
	_panel(Rect2(810,203,750,539),Color("172221"),LINE)
	_text("战斗指挥技能",Vector2(836,248),29,TEXT,true)
	_text("技能点 %d · 首通 / 指挥中心21级起每日补给"%s.commander.skillPoints,Vector2(836,284),17,GOLD)
	var ids=["skill","initiativeSkill","extraFireSkill"]
	var keys=["attackSkill","initiativeSkill","extraFireSkill"]
	var names=["战术指挥 · 每级攻击 +2%","战场预判 · 每级先手 +3","连击指挥 · 每级二次开火 +4"]
	for i in range(3):
		var level=s.commander.get(keys[i],0)
		var y=325+i*87
		_text(names[i],Vector2(837,y),21,TEXT)
		_text("Lv.%d / 120"%level,Vector2(837,y+30),17,MUTED)
		_button(ids[i],"已达120级" if level>=int(catalog.MAX_LEVEL) else "提升 · 1 技能点",Rect2(1303,y-21,228,46),null,false,level<int(catalog.MAX_LEVEL) and s.commander.skillPoints>0 and not _command_pending())
	_text("统率书军需 · 19 金币 / 本",Vector2(837,601),23,GOLD)
	_button("buyBooks","购买 %d 本 · %d 金币"%[leadership_attempts,leadership_attempts*19],Rect2(836,636,695,53),null,true,s.wallet.gold>=leadership_attempts*19 and not _command_pending())
	_text("购书数量随左侧尝试数量切换。",Vector2(837,722),17,MUTED)
	_button("powerDetails","当前满编总战力 %s · 计算说明"%_amount(info.power.ceiling),Rect2(40,771,745,48))
	_button("nav:commander","返回指挥官",Rect2(810,771,750,48),"commander")

func _repair_all_ready():
	return info.repairAll.count>0 and info.repairAll.shortage.is_empty() and not _command_pending()

func _repair_all_button(rect):
	_button("repairAll","全部修复 %d 辆 · %s"%[info.repairAll.count,_repair_material_text()] if info.repairAll.count>0 else "全部修复 · 暂无战损",rect,null,true,_repair_all_ready())

func _repair_material_text():
	var label=_cost_text(info.repairAll.cost)
	return label if label!="" else "无需追加材料"

func _draw_attributes():
	_title("属性与战力一览","COMBAT ATTRIBUTES / POWER CONTRIBUTIONS")
	_button("nav:inventory","资源一览",Rect2(1340,119,220,44),"inventory")
	var scopes=[["unit","单车型"],["formation","当前已保存编队"],["ceiling","六格满编上限"]]
	for i in range(3): _button("attributeScope:"+scopes[i][0],scopes[i][1],Rect2(40+i*269,200,255,38),scopes[i][0],attribute_scope==scopes[i][0])
	for i in range(4): _button("attributeClass:"+str(i),catalog.classNames[CLASSES[i]],Rect2(40+i*204,252,191,34),i,i==selected_class)
	for i in range(7): _button("attributeTier:"+str(i+1),"%d 阶"%(i+1),Rect2(876+i*99,252,89,34),i+1,i+1==tier)
	var unit=info.attributes.byUnit[_unit_id()]
	var sheet=unit if attribute_scope=="unit" else info.attributes[attribute_scope]
	var p=Vector2(40,309)
	_panel(Rect2(p,Vector2(1080,438)),Color("13211d"),LINE)
	for i in range(5): _text(["属性","白板","当前值","战力增量","加成来源 / 等级"][i],p+Vector2([18,213,349,503,682][i],31),18,GOLD,true)
	for i in range(8):
		var r=sheet.rows[i]
		var y=70+i*43
		if i%2==0: draw_rect(Rect2(p+Vector2(2,y-25),Vector2(1076,43)),Color("1a2823"))
		_text(r.name,p+Vector2(18,y),17,TEXT)
		var show_values=attribute_scope!="formation"
		_text(("%.1f%s"%[r.base,"%" if r.percent else ""]) if show_values else "逐车型",p+Vector2(213,y),16,MUTED)
		_text(("%.1f%s"%[r.value,"%" if r.percent else ""]) if show_values else "加总",p+Vector2(349,y),16,TEXT)
		_text("%+d"%r.delta,p+Vector2(503,y),18,GOLD,true)
		_text(r.source,p+Vector2(682,y),13,MUTED)
	var load_unit=info.attributes.bestUnit if attribute_scope=="ceiling" else _unit_id()
	var cargo=info.unitStats[load_unit].load
	if attribute_scope=="ceiling": cargo*=int(info.leadership)*6
	elif attribute_scope=="formation":
		cargo=0
		for slot in info.usable:
			if slot!=null: cargo+=slot.count*info.unitStats[slot.unitId].load
	_text("当前载重 %s · 直接战力 +0；产量 / 生产 / 采速等经济加成也不直接计分。"%_amount(cargo),p+Vector2(18,419),15,MUTED)
	_panel(Rect2(1140,309,420,438),Color("1b2720"),GOLD.darkened(0.5))
	var u=info.attributes.bestUnit if attribute_scope=="ceiling" else _unit_id()
	_image(u,Rect2(1160,330,378,143))
	_text("按多车型汇总" if attribute_scope=="formation" else catalog.units[u].name,Vector2(1160,493),24,TEXT,true)
	_text("白板基础  %d"%sheet.base,Vector2(1160,537),19,MUTED)
	_text("统率容量  +%d"%sheet.get("capacity",0),Vector2(1160,572),19,GOLD)
	_text("属性加成  +%d"%(sheet.power-sheet.base-sheet.get("capacity",0)),Vector2(1160,607),19,GOLD)
	_text("总战力  %d"%sheet.power,Vector2(1160,655),25,GOLD,true)
	_text("基础 + 容量 + 属性 = 总战力",Vector2(1160,698),17,TEXT)
	_text("当前统率：每格 %d 辆 × 6 格"%info.leadership,Vector2(1160,730),15,MUTED)
	_text("单车列使用选择车型；满编列使用最高单车分车型。混编按实际数量逐项加总。",Vector2(42,779),16,MUTED)
	_button("attributeRules","分项计算口径 / 条件光环",Rect2(40,795,499,31))
	_button("nav:army","前往编队",Rect2(1160,783,400,43),"army")



func _v21_qa(out):
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("factory-save.json"))})
	await _settled()
	selected_class=0
	tier=7
	_action("facility:factory","factory")
	_set_quantity(1)
	if _factory_quote().block=="" or _factory_quote().max!=0: return false
	hover="produce"
	await _qa_capture(out,"v21-factory-59-locked")
	for entry in buttons:
		if entry.id=="produce" and entry.enabled: return false
	hover=""
	_action("facility:factory2","factory2")
	if _factory_quote().block!="": return false
	_action("produce")
	await _settled()
	if not s.jobs.has("production:factory2"): return false
	if not await _qa_drain_jobs(): return false
	if s.available.tank_t7!=21: return false
	# Completing each physical plant's upgrade immediately refreshes its own quote.
	for facility in ["factory","refit"]:
		if facility=="factory":
			_navigate("base")
			selected_building="factory"
			_action("upgrade")
		else:
			_navigate("industry")
			_action("facilityUpgrade:refit","refit")
		await _settled()
		if not s.jobs.has("building"): return false
		if not await _qa_drain_jobs(): return false
		_action("facility:"+facility,facility)
		_set_quantity(1)
		if _factory_quote().block!="": return false
		var before=s.available.tank_t7
		var source_before=s.available.tank_t6
		_action("produce")
		await _settled()
		if not await _qa_drain_jobs(): return false
		if s.available.tank_t7!=before+1: return false
		if s.available.tank_t6!=source_before-(1 if facility=="refit" else 0): return false
	# Native screenshots cover compact buttons and all gate text at supported sizes.
	_action("facility:factory","factory")
	_set_quantity(10)
	for window_size in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=window_size
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			await _qa_capture(out,"v21-factory-%dx%d-%d"%[window_size.x,window_size.y,roundi(scale_value*100)])
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	_action("facility:refit","refit")
	await _qa_capture(out,"v21-refit-60")
	if "%.2f" in _upgrade_benefits("refit"): return false
	_action("upgradeBenefits","refit")
	await _qa_capture(out,"v21-upgrade-unlocks")
	details_dialog.hide()
	_navigate("library")
	library_category="arsenal"
	library_selected="production"
	await _qa_capture(out,"v21-library")
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("capacity-save.json"))})
	await _settled()
	_action("facility:refit","refit")
	_set_quantity(1)
	if not "当前最高 59" in _factory_quote().block: return false
	hover="produce"
	await _qa_capture(out,"v21-refit-manufacture-capacity")
	hover=""
	# Exported by the actual v0.20 runtime at factory20, including three FIFO backlogs.
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("legacy-save.json"))})
	await _settled()
	if s.buildings.factory!=20 or s.jobBacklog.size()!=3 or info.unitStats.tank_t7.produce.block=="": return false
	var originals=s.jobs.duplicate(true)
	_navigate("queues")
	await _qa_capture(out,"v21-legacy-paid-orders")
	if not await _qa_drain_jobs(): return false
	if s.available.tank_t7!=12 or s.available.tank_t6!=16 or s.arsenal.cores.tank_core7!=8: return false
	_action("coreDungeons")
	selected_dungeon=0
	if info.dungeonStatus[0].block!="" or info.dungeonStatus[1].block=="": return false
	await _qa_capture(out,"v21-legacy-core-supply")
	var result={"save_root":save_root,"second_factory_independent":"pass","first_factory_59_to_60":"pass","refit_59_to_60":"pass","refit_manufacturing_requirement":"pass","legacy_source_version":"0.20.0","legacy_orders_completed":12,"legacy_paid_inputs_not_charged_twice":"pass","legacy_core_rechallenge":"pass","original_job_snapshots":originals,"resolutions":4,"scales":[100,120]}
	FileAccess.open(out.path_join("unlock-ui.json"),FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
	print("V21_UNLOCK_PASS")
	return true

func _experience25_qa(out):
	muted=true
	var meta=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("meta.json")))
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("ready-save.json"))})
	await _settled()
	if s.is_empty() or s.damaged.tank_t7!=7: return false
	selected_site=meta.site
	var saved_reports=JSON.stringify(s.reports)
	var saved_wallet=JSON.stringify(s.wallet)
	_navigate("repair")
	await _qa_capture(out,"repair-current")
	if buttons.filter(func(b):return b.id.begins_with("repairUnit:")).size()!=2: return false
	_action("repairFilter")
	await _qa_capture(out,"repair-history")
	if buttons.filter(func(b):return b.id.begins_with("repairUnit:")).size()!=3: return false
	_action("repairFilter")
	_action("repairUnit:spg_t7","spg_t7")
	if quantity>6 or quantity<1: return false
	_action("scoutDetails")
	if screen!="intel": return false
	await _qa_capture(out,"intel-known")
	request({"op":"report","id":meta.report,"summaryOnly":true})
	await _settled()
	_action("battleSkip")
	var rewards=_settlement_rewards()
	if rewards.filter(func(r):return r.icon=="growth:xp").is_empty(): return false
	if _next_battle_target().get("stage",-1)!=1: return false
	_report_details()
	await _qa_capture(out,"report-dialog")
	if not details_text.text.contains("经验"): return false
	details_dialog.hide()
	_action("battleNext")
	if screen!="deployment" or deployment.command.stage!=1: return false
	_action("deploymentCancel")
	if JSON.stringify(s.reports)!=saved_reports or JSON.stringify(s.wallet)!=saved_wallet: return false
	for window_size in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=window_size
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			var suffix="-%dx%d-%d"%[window_size.x,window_size.y,roundi(scale_value*100)]
			_navigate("repair")
			await _qa_capture(out,"repair"+suffix)
			_navigate("intel")
			await _qa_capture(out,"intel"+suffix)
			_navigate("army")
			_action("slot:0",0)
			await _qa_capture(out,"army"+suffix)
			request({"op":"report","id":meta.report,"summaryOnly":true})
			await _settled()
			_action("battleSkip")
			await _qa_capture(out,"settlement"+suffix)
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	_navigate("factory")
	production_mode="refit"
	tier=1
	await _qa_capture(out,"refit-no-prototype")
	_navigate("repair")
	_confirm({},"维修确认说明\n".repeat(12))
	await _qa_capture(out,"dialog-long")
	var tall=confirm_dialog.size.y
	confirm_dialog.hide()
	_confirm({},"消耗金币加速当前任务？\n只处理该作业。")
	await _qa_capture(out,"dialog-short")
	if confirm_dialog.size.y>=tall or quantity_input.visible: return false
	confirm_dialog.hide()
	_navigate("world")
	map_level=1
	await _qa_capture(out,"map-selected-outside-filter")
	_action("mapClear")
	if map_level!=0 or map_intel!="all" or map_resource!="all": return false
	selected_site=s.world.filter(func(v):return not s.intel.has(v.id))[0].id
	_navigate("intel")
	await _qa_capture(out,"intel-unknown")
	_navigate("repair")
	var available=s.available.spg_t7
	var q=info.repairAll
	command({"type":"repairAll","quote":q.token})
	await _settled()
	if s.damaged.spg_t7!=0 or s.available.spg_t7!=available+6: return false
	await _qa_capture(out,"repair-complete")
	command({"type":"rest","minutes":60})
	await _settled()
	await _qa_capture(out,"rest-result")
	request({"op":"report","id":meta.report,"summaryOnly":true})
	await _settled()
	_action("battleSkip")
	_action("rematch")
	await _settled()
	if screen!="battle" or s.reports.size()!=2: return false
	_action("battleSkip")
	var snapshot=JSON.stringify(s.available)+JSON.stringify(s.wallet)+JSON.stringify(s.arsenal)
	_action("battleReplay")
	_action("battleSkip")
	if snapshot!=JSON.stringify(s.available)+JSON.stringify(s.wallet)+JSON.stringify(s.arsenal): return false
	FileAccess.open(out.path_join("experience25-ui.json"),FileAccess.WRITE).store_string(JSON.stringify({"pass":true,"repair_filter_and_counts":true,"repair_all_inventory":true,"intel_cards_and_unknown":true,"next_stage_cancel_no_settlement":true,"rematch_direct":true,"replay_no_credit":true,"modal_shrink_and_input_hidden":true,"resolutions":4,"scales":[100,120],"save_root":save_root},"  "))
	return true

func _round_hud_qa(out):
	var fixtures=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("round-fixtures.json")))
	var shots=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("combat-fixtures.json")))
	var original_mute=muted
	muted=true
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("round-save.json"))})
	await _settled()
	if s.reports.size()!=3 or s.reports[0].rounds!=50 or s.reports[2].rounds!=40: return false
	var saved_reports=JSON.stringify(s.reports)
	# A volley must identify the current shooter, even after all its events have
	# been scheduled and battle_index already points to the opposing army.
	for id in ["tank-full-0","spg-two-0","destroyer-rear-1","rocket-full-1"]:
		var f=shots.filter(func(v):return v.id==id)[0]
		open_report(f)
		settlement_visible=false
		battle_paused=true
		battle_speed=1
		_battle_step(1.20)
		var first=f.events[0]
		var source=f.initial[int(first.side)].filter(func(st):return st.slot==first.from)[0]
		var expected=("我方攻击 · " if first.side==0 else "敌方攻击 · ")+str(catalog.classNames[source.classId])
		if _battle_actor_label()!=expected or _battle_round_label()!="1 / 50": return false
		if id=="rocket-full-1":
			if int(f.events[battle_index].side)==int(first.side): return false
			await _qa_capture(out,"active-rocket")
	for window_size in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=window_size
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			var f=fixtures[0 if scale_value==1.0 else 1]
			open_report(f)
			settlement_visible=false
			battle_paused=true
			battle_speed=1
			for i in range(4000):
				if int(last_hit.get("round",0))>=12: break
				_battle_step(0.05)
			if _battle_round_label()!="12 / 50": return false
			await _qa_capture(out,"round-12-%dx%d-%d"%[window_size.x,window_size.y,roundi(scale_value*100)])
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	for first in [0,1]:
		open_report(fixtures[first])
		battle_paused=true
		_action("battleSkip")
		if not _battle_done() or not settlement_visible or _battle_round_label()!="50 / 50": return false
		if report.winner!=1-first or report.endReason!="round-limit": return false
		await _qa_capture(out,"timeout-result-"+str(first))
		settlement_visible=false
		await _qa_capture(out,"round-50-"+str(first))
	open_report(fixtures[2])
	battle_paused=true
	_seek_battle_end()
	settlement_visible=false
	if _battle_round_label()!="40 / 40" or report.winner!=fixtures[2].winner: return false
	await _qa_capture(out,"legacy-40")
	if JSON.stringify(s.reports)!=saved_reports: return false
	muted=original_mute
	_stop_battle_audio()
	FileAccess.open(out.path_join("round-ui.json"),FileAccess.WRITE).store_string(JSON.stringify({"pass":true,"current_actor_not_next":true,"round_12_of_50":true,"both_timeout_sides":true,"legacy_40_unchanged":true,"replay_does_not_mutate_reports":true,"resolutions":4,"scales":[100,120],"isolated_save_root":save_root},"  "))
	return true

func _indirect_fire_qa(out):
	var fixtures=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("combat-fixtures.json")))
	var original_mute=muted
	muted=true
	var cases=[]
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	for id in ["spg-two-0","spg-two-1","rocket-full-0","rocket-full-1"]:
		var fixture=fixtures.filter(func(f):return f.id==id)[0]
		for phase in [{"name":"launch","at":0.095},{"name":"descent","at":0.27},{"name":"impact","at":0.36}]:
			open_report(fixture)
			settlement_visible=false
			battle_paused=true
			battle_speed=1
			_battle_step(1.05+phase.at)
			if phase.name!="impact":
				var e=fixture.events[0]
				var unit=fixture.initial[int(e.side)].filter(func(st):return st.slot==e.from)[0]
				var pose=_battle_pose(unit.unitId,int(e.side),int(e.from))
				var target=_unit_position(1-int(e.side),int(e.to))-Vector2(0,20)
				var degrees=60.0 if unit.classId=="spg" else 45.0
				var trail=_shot_trail(pose.muzzle,target,pose.launch,battle_clock-battle_shots[0].at,true,degrees)
				if trail.is_empty(): return false
				var direction=(trail.head-trail.tail).normalized()
				if phase.name=="launch" and direction.dot(pose.launch)<0.99998: return false
				if phase.name=="descent" and absf(rad_to_deg(atan2(direction.y,absf(direction.x)))-degrees)>0.05: return false
			await _qa_capture(out,id+"-"+phase.name)
		cases.append(id)
	muted=original_mute
	_stop_battle_audio()
	FileAccess.open(out.path_join("indirect-ui.json"),FileAccess.WRITE).store_string(JSON.stringify({"pass":true,"fixtures":cases,"captures":12,"spg_descent_degrees":60,"rocket_descent_degrees":45,"isolated_save_root":save_root},"  "))
	return true

func _rocket_live_failure(stage):
	print("ROCKET_LIVE_FAILED: ",stage," clock=",battle_clock," screen=",screen," events=",battle_audio_events," pending=",battle_pending_impacts.size()," craters=",battle_craters.size()," voices=",battle_voices.map(func(v):return {"playing":v.playing,"paused":v.stream_paused}))
	_stop_battle_audio()
	return false

func _rocket_live_qa(out):
	var fixtures=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("combat-fixtures.json")))
	var fixture=fixtures.filter(func(f):return f.id=="rocket-one-0")[0]
	var original_mute=muted
	muted=false
	open_report(fixture)
	settlement_visible=false
	battle_speed=1
	# Let actual frame updates and AudioStreamPlayers run, rather than manually seeking.
	for i in range(160):
		if battle_clock>=1.20: break
		await get_tree().create_timer(0.02).timeout
	if battle_clock<1.20 or battle_audio_events.size()!=1: return _rocket_live_failure("launch")
	battle_paused=true
	_sync_battle_audio()
	var frozen=battle_clock
	# Godot's playing is false while paused; the playback object remains active.
	var paused_voices=battle_voices.filter(func(v):return v.has_stream_playback() and v.stream_paused)
	if paused_voices.is_empty(): return _rocket_live_failure("paused voice")
	var voice=paused_voices[0]
	var audio_at=voice.get_playback_position()
	await get_tree().create_timer(0.18).timeout
	if battle_clock!=frozen or battle_audio_events.size()!=1: return _rocket_live_failure("frozen clock")
	if absf(voice.get_playback_position()-audio_at)>0.04: return _rocket_live_failure("frozen audio")
	battle_paused=false
	_sync_battle_audio()
	if not voice.playing or voice.get_playback_position()<audio_at-0.04: return _rocket_live_failure("resume voice")
	for i in range(160):
		if battle_clock>=1.80: break
		await get_tree().create_timer(0.02).timeout
	battle_paused=true
	_sync_battle_audio()
	if pending_hit or battle_audio_events.size()!=2 or battle_craters.size()!=5: return _rocket_live_failure("impacts")
	await _qa_capture(out,"rocket-live-salvo-complete")
	muted=true
	_sync_battle_audio()
	if battle_voices.any(func(v):return v.has_stream_playback()): return _rocket_live_failure("mute")
	muted=false
	_sync_battle_audio()
	if battle_audio_events.size()!=2 or battle_voices.any(func(v):return v.has_stream_playback()): return _rocket_live_failure("unmute")
	muted=true
	open_report(fixture)
	battle_paused=true
	_battle_step(10000)
	if not battle_audio_events.is_empty(): return _rocket_live_failure("silent replay")
	muted=original_mute
	_stop_battle_audio()
	FileAccess.open(out.path_join("rocket-live.json"),FileAccess.WRITE).store_string(JSON.stringify({"pass":true,"real_frames":true,"once_fire_once_impact":true,"pause_resume_no_restart":true,"mute_stops_no_retrigger":true,"ground_craters":5},"  "))
	return true

func _rocket_salvo_check(fixture,out):
	var events=fixture.events.filter(func(e):return e.action==1)
	_battle_step(1.08)
	if battle_volley.size()!=6 or battle_pending_impacts.size()!=6 or battle_shots.size()!=6: return false
	if battle_audio_events.size()!=1 or battle_audio_events[0].key!="rocket_fire": return false
	for i in range(6):
		var at=hit_time+ROCKET_LAUNCH_OFFSETS[i]+0.32
		_battle_step(maxf(0,at-battle_clock-0.002))
		if battle_pending_impacts.size()!=6-i: return false
		var e=events[i]
		if not e.get("ground",false) and not e.miss:
			var before=battle_armies[1-int(e.side)].filter(func(st):return st.slot==e.to)[0]
			if before.totalHp==e.hp: return false
		_battle_step(0.004)
		if battle_pending_impacts.size()!=5-i: return false
		if e.get("ground",false):
			if absf(battle_craters[-1].at-at)>0.00001 or battle_craters[-1].slot!=int(e.to): return false
		else:
			var after=battle_armies[1-int(e.side)].filter(func(st):return st.slot==e.to)[0]
			if after.totalHp!=e.hp or after.count!=e.remaining: return false
		if i==2 and fixture.id in ["rocket-one-0","rocket-full-0"]:
			await _qa_capture(out,"rocket-cluster-"+fixture.id)
	if pending_hit or battle_audio_events.filter(func(e):return e.key=="rocket_fire").size()!=1: return false
	var impact_count=1 if events.any(func(e):return not e.miss) else 0
	if battle_audio_events.filter(func(e):return e.key=="rocket_impact").size()!=impact_count: return false
	return true

func _combat_qa(out, revision="v20"):
	var fixtures = JSON.parse_string(FileAccess.get_file_as_string(out.path_join("combat-fixtures.json")))
	if not fixtures is Array: return false
	var original_mute=muted
	muted=false
	var launches_checked=0
	for fixture in fixtures:
		open_report(fixture)
		battle_paused=true
		battle_speed=1
		var first_events=fixture.events.filter(func(e): return e.action==1)
		if fixture.has("qaTargets") and first_events.map(func(e): return e.to)!=fixture.qaTargets: return false
		if revision=="v22" and fixture.initial[int(first_events[0].side)][0].classId=="tank" and first_events.any(func(e):return e.get("ground",false)): return false
		var rocket=fixture.initial[int(first_events[0].side)][0].classId=="rocket"
		if rocket:
			if not await _rocket_salvo_check(fixture,out):
				print("ROCKET_FAILED: ",fixture.id," clock=",battle_clock," pending=",battle_pending_impacts.size())
				return false
			launches_checked+=6
		else:
			for index in range(first_events.size()):
				_battle_step(1.17 if index==0 else 0.22)
				if not pending_hit or last_hit.shot!=index+1 or battle_volley.size()!=1:
					print(revision+"_FAILED launch ",fixture.id," ",index)
					return false
				if battle_audio_events.filter(func(e):return e.key.ends_with("_fire")).size()!=index+1: return false
				if not last_hit.get("ground",false):
					var st=battle_armies[1-int(last_hit.side)].filter(func(v):return v.slot==last_hit.to)[0]
					if not last_hit.miss and st.totalHp==last_hit.hp: return false
				if revision=="v22" and fixture.id=="tank-mixed-0" and index==1:
					_battle_step(0.16)
					await _qa_capture(out,"v22-tank-exposed-rear")
					_battle_step(0.14)
				else: _battle_step(0.30)
				if pending_hit: return false
				launches_checked+=1
		var ground_count=first_events.filter(func(e):return e.get("ground",false)).size()
		if battle_craters.size()!=ground_count: return false
		if ground_count>0:
			var crater=battle_craters[0].duplicate(true)
			var before=_crater_position(crater)
			var clock_before=battle_clock
			battle_clock+=0.4
			if (_crater_position(crater)-before-_ground_displacement(crater.side,0.4)).length()>0.001:
				print(revision+"_FAILED ground anchor")
				return false
			battle_clock=clock_before
		if fixture.id in ["tank-two-0","tank-mixed-0","tank-rear-0","spg-one-0","spg-two-0","destroyer-rear-0","rocket-one-0","rocket-two-1"]:
			await _qa_capture(out,revision+"-"+fixture.id)
			var frozen=get_viewport().get_texture().get_image().get_data()
			await get_tree().create_timer(0.12).timeout
			await RenderingServer.frame_post_draw
			if frozen!=get_viewport().get_texture().get_image().get_data(): return false
		var expected_craters=-1
		var expected_clock=-1.0
		for speed in [1,2,4]:
			open_report(fixture)
			battle_paused=true
			battle_speed=speed
			_battle_step(10000)
			if not _battle_done(): return false
			for side in range(2):
				for j in range(battle_armies[side].size()):
					if battle_armies[side][j].totalHp!=fixture.final[side][j].totalHp: return false
			if rocket:
				var fire_actions={}
				var impact_actions={}
				for e in fixture.events:
					var source=fixture.initial[int(e.side)].filter(func(st):return st.slot==e.from)[0]
					if source.classId!="rocket": continue
					fire_actions[e.action]=true
					if not e.miss: impact_actions[e.action]=true
				if battle_audio_events.filter(func(e):return e.key=="rocket_fire").size()!=fire_actions.size(): return false
				if battle_audio_events.filter(func(e):return e.key=="rocket_impact").size()!=impact_actions.size(): return false
			if expected_craters<0:
				expected_craters=battle_craters.size()
				expected_clock=battle_clock
			if battle_craters.size()!=expected_craters or absf(battle_clock-expected_clock)>0.001: return false
		_action("battleSkip")
		if not _battle_done() or battle_craters.size()!=expected_craters: return false
		open_report(fixture)
		battle_paused=true
		_action("battleStep")
		if battle_index<first_events.size() or pending_hit: return false
	# Genuine v0.14 snapshots keep their original rocket grouping and damage.
	var legacy=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("legacy-fixtures.json")))
	if not legacy is Dictionary: return false
	for old_report in legacy.volleys+[legacy.historical]:
		open_report(old_report)
		battle_paused=true
		_battle_step(10000)
		if not battle_craters.is_empty(): return false
		for side in range(2):
			for j in range(battle_armies[side].size()):
				if battle_armies[side][j].totalHp!=old_report.final[side][j].totalHp: return false
	if revision=="v22":
		var old_tanks=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("legacy-tank-fixtures.json")))
		if not old_tanks is Array: return false
		for old_report in old_tanks:
			open_report(old_report)
			battle_paused=true
			_battle_step(10000)
			if battle_craters.size()!=old_report.events.filter(func(e):return e.get("ground",false)).size(): return false
			for side in range(2):
				for j in range(battle_armies[side].size()):
					if battle_armies[side][j].totalHp!=old_report.final[side][j].totalHp: return false
	# Check layouts in real windows, with a sparse rocket formation and moving terrain decals.
	var scene=fixtures.filter(func(f):return f.id=="rocket-one-0")[0]
	for window_size in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=window_size
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			open_report(scene)
			battle_paused=true
			battle_speed=1
			_battle_step(4.12)
			await _qa_capture(out,revision+"-craters-%dx%d-%d"%[window_size.x,window_size.y,roundi(scale_value*100)])
			if revision=="v22":
				_navigate("doctrine")
				await _qa_capture(out,"v22-doctrine-%dx%d-%d"%[window_size.x,window_size.y,roundi(scale_value*100)])
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	_navigate("doctrine")
	await _qa_capture(out,revision+"-doctrine")
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("repair-save.json"))})
	await _settled()
	_navigate("repair")
	repair_unit="tank_t7"
	_set_quantity(2)
	await _qa_capture(out,revision+"-repair-cost")
	var unit_cost=info.unitStats.tank_t7.repair.unitCost.crystal
	var wallet_before=s.wallet.crystal
	command({"type":"repair","unitId":"tank_t7","count":2})
	await _settled()
	if s.jobs.repair.unitCost.crystal!=unit_cost or absf(wallet_before-s.wallet.crystal-unit_cost*2)>1:
		print(revision+"_FAILED repair quote")
		return false
	var q=info.repairAll.duplicate(true)
	wallet_before=s.wallet.crystal
	_action("repairAll")
	if not confirm_dialog.visible: return false
	await _qa_capture(out,revision+"-repair-all-confirm")
	_confirm_action()
	confirm_dialog.hide()
	await _settled()
	if info.repairAll.count!=0 or s.jobs.has("repair") or absf(wallet_before-s.wallet.crystal-q.cost.crystal)>1:
		print(revision+"_FAILED repair all quote")
		return false
	for id in ["tank_t1","tank_t7","spg_t7","rocket_t7"]:
		if s.available[id]<7 or s.damaged[id]!=0: return false
	await _qa_capture(out,revision+"-repair-completed")
	muted=original_mute
	_stop_battle_audio()
	var result={"fixtures":fixtures.size(),"launches_checked":launches_checked,"four_classes_both_sides":"pass","ground_has_no_casualties":"pass","ground_displacement":"pass","pause_pixels":"pass","speed_step_skip_replay":"pass","legacy_snapshots":"pass","discounted_repair_and_all":"pass","resolutions":4,"scales":[100,120],"save_root":save_root}
	FileAccess.open(out.path_join("combat-ui.json"),FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
	print(revision+"_COMBAT_PASS: ",JSON.stringify(result))
	return true

func _v19_qa(out):
	print("V19_QA: legacy orders, real day-scale work, batch limit and capacity bars")
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v19-legacy-save.json"))})
	await _settled()
	if s.jobs.get("production",{}).get("total",0)!=1000 or s.jobs.production.duration!=5000: return false
	command({"type":"rest","minutes":480})
	await _settled()
	if s.available.tank_t1!=2020 or not s.jobs.is_empty(): return false
	var legacy_id=s.id
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v19-save.json"))})
	await _settled()
	if s.buildings.hq!=119 or s.worldRules!="renewable-v3" or s.id==legacy_id: return false
	selected_class=0
	tier=7
	selected_factory="factory"
	production_mode="produce"
	_navigate("factory")
	_action("quantityMax")
	var quote=_factory_quote().duplicate(true)
	if quantity!=100 or quote.max!=100: return false
	var batch_hours=_effective_time(quote.duration*100)/3600000.0
	if batch_hours<39 or batch_hours>64: return false
	quantity_input.text="101"
	quantity_input.text_changed.emit("101")
	hover="produce"
	await _qa_capture(out,"v19-batch-limit")
	if quantity!=101 or not "100" in _disabled_reason("produce",null): return false
	for entry in buttons:
		if entry.id=="produce" and entry.enabled: return false
	hover=""
	_action("quantityMax")
	for size_px in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		DisplayServer.window_set_size(size_px)
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			for page in ["base","factory","research"]:
				_navigate(page)
				selected_building="hq"
				research_branch="combat"
				selected_tech="ballistics"
				await _qa_capture(out,"v19-%s-%dx%d-%d"%[page,size_px.x,size_px.y,roundi(scale_value*100)])
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	_navigate("base")
	await _qa_capture(out,"v19-capacity-fullscreen")
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(1280,720))
	ui_scale=1.0
	hover="resource:crystal"
	await _qa_capture(out,"v19-overcapacity-tooltip")
	hover=""
	_navigate("library")
	library_selected="time"
	library_category="economy"
	await _qa_capture(out,"v19-library-pacing")
	_navigate("base")
	selected_building="hq"
	_action("upgrade")
	await _settled()
	if not s.jobs.has("building"): return false
	var construction_hours=_effective_time(s.jobs.building.duration)/3600000.0
	if construction_hours<12 or construction_hours>120: return false
	_navigate("research")
	_action("research:attack","attack")
	await _settled()
	if not s.jobs.has("research"): return false
	_navigate("factory")
	selected_factory="factory"
	production_mode="produce"
	_set_quantity(100)
	_action("produce")
	await _settled()
	if not s.jobs.has("production") or s.jobs.production.duration!=quote.duration: return false
	_action("produce")
	await _settled()
	selected_factory="factory2"
	_action("produce")
	await _settled()
	_action("produce")
	await _settled()
	if s.jobBacklog.size()!=2: return false
	_action("productionMode:refit","refit")
	_action("produce")
	await _settled()
	if s.available.tank_t6!=1900 or s.arsenal.cores.tank_core7!=0: return false
	command({"type":"repair","unitId":"tank_t7","count":12})
	await _settled()
	_navigate("queues")
	await _qa_capture(out,"v19-multiday-queues")
	for i in range(12):
		command({"type":"rest","minutes":480})
		await _settled()
	if not s.jobs.is_empty() or not s.jobBacklog.is_empty() or s.available.tank_t7!=2512 or s.buildings.hq!=120 or s.tech.attack!=119: return false
	_navigate("factory")
	selected_factory="factory"
	production_mode="produce"
	await _qa_capture(out,"v19-delivered-inventory")
	var inventory=s.available.duplicate(true)
	request({"op":"save"})
	await _settled()
	request({"op":"load","id":s.id})
	await _settled()
	if s.available!=inventory: return false
	for site in s.world:
		if site.kind=="mine" and site.resource=="iron" and site.level==120: selected_site=site.id
	_navigate("world")
	_action("scout")
	await _settled()
	var trip=info.marchQuotes[selected_site].duplicate(true)
	if trip.tripMultiple<5: return false
	_begin_world_deployment("gather")
	await _qa_capture(out,"v19-world-plan")
	_confirm_deployment()
	await _settled()
	if s.marches.size()!=1 or s.marches[0].capacity!=trip.load: return false
	command({"type":"rest","minutes":480})
	await _settled()
	if not s.marches.is_empty() or s.expeditionLog.size()!=1 or s.expeditionLog[0].cargo.iron<=0: return false
	var receipt=s.expeditionLog[0].duplicate(true)
	var wallet=s.wallet.duplicate(true)
	var vehicles=s.available.duplicate(true)
	open_report(s.reports[0])
	_action("battleSkip")
	await _qa_capture(out,"v19-world-return")
	if report.get("transport",{}).get("status","")!="returned" or s.wallet!=wallet or s.available!=vehicles: return false
	var status={"save_root":save_root,"legacy_1000_batches":2020,"manufacture_batch_hours":batch_hours,"hq_119_to_120_hours":construction_hours,"max_100_and_101_disabled":"pass","four_factory_batches_refit_repair_total":2512,"research_118_to_119":"pass","large_rest_and_reload":"pass","return_and_replay_once":"pass","return_receipt":receipt,"resolutions":4,"scales":[100,120],"fullscreen":"pass"}
	FileAccess.open(out.path_join("pacing-ui.json"),FileAccess.WRITE).store_string(JSON.stringify(status,"  "))
	print("V19_PACING_PASS: ",JSON.stringify(status))
	return true

func _v18_qa(out):
	print("V18_QA: economy, scouting, transport snapshot and return receipt")
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v18-save.json"))})
	await _settled()
	if s.worldRules!="renewable-v3" or info.rates.iron!=1533375: return false
	for v in s.world:
		if v.kind=="mine" and v.resource=="iron" and v.level==120: selected_site=v.id
	map_resource="iron"
	map_level=6
	map_intel="all"
	map_zoom=1
	map_center=Vector2(16,16)
	_navigate("world")
	_begin_world_deployment("gather")
	if not deployment.unknown or deployment.enemy.any(func(st):return st!=null): return false
	_action("deploymentCancel")
	var scout_cost=info.marchQuotes[selected_site].scoutCost
	var crystal=s.wallet.crystal
	var before_scout=s.now
	_action("scout")
	await _settled()
	var max_passive=ceili(info.rates.crystal*(s.now-before_scout)/3600000.0)
	if not s.intel.has(selected_site) or s.wallet.crystal<crystal-scout_cost or s.wallet.crystal>crystal-scout_cost+max_passive: return false
	_scout_details()
	if not "科技 60 级" in details_text.text or info.knownGuardStats[selected_site].size()!=6: return false
	await _qa_capture(out,"v18-scout-guard-tech")
	details_dialog.hide()
	var quote=info.marchQuotes[selected_site].duplicate(true)
	if quote.tripMultiple<6 or quote.load<14000000: return false
	for size_px in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		DisplayServer.window_set_size(size_px)
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			for page in ["world","army","inventory"]:
				_navigate(page)
				inventory_category="materials"
				await _qa_capture(out,"v18-%s-%dx%d-%d"%[page,size_px.x,size_px.y,roundi(scale_value*100)])
	_navigate("world")
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	await _qa_capture(out,"v18-world-fullscreen")
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(1280,720))
	ui_scale=1.0
	_navigate("inventory")
	_inventory_details("iron")
	await _qa_capture(out,"v18-economy-details")
	details_dialog.hide()
	_navigate("research")
	research_branch="economy"
	selected_tech="resourceOutput"
	await _qa_capture(out,"v18-economy-research")
	_navigate("world")
	_begin_world_deployment("gather")
	deployment_enemy=true
	if deployment.guardTech!=60 or _formation_tactics(deployment.enemy,false).initiative!=info.knownGuardStats[selected_site][0].initiative: return false
	await _qa_capture(out,"v18-guard-deployment")
	deployment_enemy=false
	_action("departurePlan")
	await _qa_capture(out,"v18-departure-plan")
	details_dialog.hide()
	_confirm_deployment()
	await _settled()
	if s.marches.size()!=1 or s.marches[0].capacity!=quote.load or not s.marches[0].has("unitLoads"): return false
	await _qa_capture(out,"v18-expedition-outbound")
	command({"type":"rest","minutes":60})
	await _settled()
	_navigate("world")
	await _qa_capture(out,"v18-expedition-gathering")
	command({"type":"rest","minutes":60})
	await _settled()
	if not s.marches.is_empty() or s.expeditionLog.size()!=1 or s.expeditionLog[0].cargo.iron<=0: return false
	var receipt=s.expeditionLog[0].duplicate(true)
	await _qa_capture(out,"v18-return-summary")
	_expedition_history()
	await _qa_capture(out,"v18-return-receipt")
	details_dialog.hide()
	var wallet=s.wallet.duplicate(true)
	var available=s.available.duplicate(true)
	open_report(s.reports[0])
	_action("battleSkip")
	await _qa_capture(out,"v18-world-settlement")
	if report.get("transport",{}).get("status","")!="returned" or s.wallet!=wallet or s.available!=available: return false
	var status={"budget_rate_iron":info.rates.iron,"warehouse":info.capacity,"scout_cost":scout_cost,"load_snapshot":quote.load,"trip_gross_multiple":quote.tripMultiple,"receipt":receipt,"return_and_replay_once":"pass","hidden_and_known_guards":"pass","resolutions":4,"scales":[100,120]}
	FileAccess.open(out.path_join("economy-ui.json"),FileAccess.WRITE).store_string(JSON.stringify(status,"  "))
	print("V18_ECONOMY_PASS: ",JSON.stringify(status))
	return true

func _v17_qa(out):
	print("V17_QA: 120 levels, material curve, compact amounts and exact values")
	var cases=[[999,"999"],[1000,"1K"],[1010,"1.01K"],[999999,"999.99K"],[1000000,"1M"],[123456789,"123.45M"],[1000000000,"1G"],[999999999999,"999.99G"],[1000000000000,"1T"],[-1234567,"-1.23M"]]
	for pair in cases:
		if _amount(pair[0])!=pair[1]: return false
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v17-save.json"))})
	await _settled()
	if s.buildings.hq!=119 or catalog.MAX_LEVEL!=120 or int(info.level)!=120: return false
	_navigate("base")
	selected_building="hq"
	await _qa_capture(out,"v17-base-upgrade-119")
	hover="resource:oil"
	await _qa_capture(out,"v17-exact-resource-tooltip")
	hover=""
	_navigate("inventory")
	inventory_category="materials"
	await _qa_capture(out,"v17-resources")
	_inventory_details("oil")
	if not "1,000,000,000,000" in details_text.text: return false
	await _qa_capture(out,"v17-exact-resource-details")
	details_dialog.hide()
	_navigate("base")
	_action("upgrade")
	await _settled()
	if s.jobs.get("building",{}).get("target","")!="hq": return false
	if not await _qa_drain_jobs(): return false
	if s.buildings.hq!=120 or not info.buildingCosts.hq.is_empty() or info.buildingTimes.hq!=0: return false
	_navigate("base")
	await _qa_capture(out,"v17-base-max-120")
	_action("upgradeBenefits","hq")
	await _qa_capture(out,"v17-max-benefits")
	details_dialog.hide()
	command({"type":"upgrade","building":"lab"})
	await _settled()
	if not await _qa_drain_jobs(): return false
	if s.buildings.lab!=120: return false
	_navigate("research")
	research_branch="combat"
	selected_tech="attack"
	if info.researchQuotes.attack.block!="": return false
	await _qa_capture(out,"v17-research-119")
	_action("research:attack","attack")
	await _settled()
	if not await _qa_drain_jobs(): return false
	if s.tech.attack!=120 or not info.researchQuotes.attack.unitCost.is_empty(): return false
	_navigate("research")
	await _qa_capture(out,"v17-research-max-120")
	_navigate("industry")
	for facility in ["factory","factory2","refit"]:
		_action("facilityUpgrade:"+facility,facility)
		await _settled()
		if not await _qa_drain_jobs(): return false
		if info.facilities[facility].level!=120 or info.facilities[facility].upgrade.speedPercent!=100: return false
	_navigate("industry")
	await _qa_capture(out,"v17-industry-max-120")
	_navigate("commandTraining")
	for id in ["skill","initiativeSkill","extraFireSkill"]:
		_action(id)
		await _settled()
	if s.commander.attackSkill!=120 or s.commander.initiativeSkill!=120 or s.commander.extraFireSkill!=120: return false
	await _qa_capture(out,"v17-skills-max-120")
	# Reading pages must not change inventory or consume random draws.
	var saved=s.available.duplicate(true)
	var draws=s.seed
	_navigate("world")
	await _qa_capture(out,"v17-world-high-yield")
	for size_px in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		DisplayServer.window_set_size(size_px)
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			for page in ["base","inventory","industry","research","commandTraining"]:
				_navigate(page)
				if page=="research":
					research_branch="industry"
					selected_tech="materials"
				await _qa_capture(out,"v17-%s-%dx%d-%d"%[page,size_px.x,size_px.y,roundi(scale_value*100)])
	if s.available!=saved or s.seed!=draws: return false
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	_navigate("base")
	await _qa_capture(out,"v17-fullscreen")
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(1280,720))
	ui_scale=1.0
	var status={"levels":120,"upgrade_research_industry_skills":"pass","compact_boundary_cases":cases.size(),"exact_values":"pass","inventory_seed_unchanged":"pass","resolutions":4,"scales":[100,120]}
	FileAccess.open(out.path_join("growth.json"),FileAccess.WRITE).store_string(JSON.stringify(status,"  "))
	print("V17_GROWTH_PASS: ",JSON.stringify(status))
	return true

func _v16_qa(out):
	print("V16_QA: classified library, independent reading and navigation")
	request({"op":"new","nickname":"图书馆验收副本","seed":26100316})
	await _settled()
	var inventory=s.available.duplicate(true)
	var cores=s.arsenal.cores.duplicate(true)
	var seed=s.seed
	_navigate("base")
	await _qa_capture(out,"v16-base-entry")
	_action("nav:library","library")
	await _qa_capture(out,"v16-library-initiative")
	if catalog.fieldLibrary.entries.size()!=26 or library_reader.text.find("118")<0: return false
	for category in catalog.fieldLibrary.categories:
		_action("libraryCategory:"+category.id,category.id)
		if not _library_filtered().all(func(row): return row.category==category.id): return false
		await _qa_capture(out,"v16-category-"+category.id)
	_action("libraryCategory:all","all")
	library_search.text="闪避 命中"
	library_search.text_changed.emit(library_search.text)
	await _qa_capture(out,"v16-search-evasion")
	if not _library_filtered().any(func(row): return row.id=="hit-evasion"): return false
	library_search.text="无此条目123"
	library_search.text_changed.emit(library_search.text)
	await _qa_capture(out,"v16-search-empty")
	if not _library_filtered().is_empty() or library_reader.visible: return false
	_action("libraryClear")
	_library_choose("research")
	await get_tree().create_timer(0.15).timeout
	library_reader.get_v_scroll_bar().value=220
	var stored=library_reader.get_v_scroll_bar().value
	if stored<50: return false
	_library_choose("hit-evasion")
	await get_tree().create_timer(0.15).timeout
	if library_reader.get_v_scroll_bar().value!=0: return false
	_details("图书馆独立滚动验收","长文\n".repeat(180))
	await get_tree().create_timer(0.1).timeout
	details_text.scroll_vertical=70
	details_dialog.hide()
	_library_choose("research")
	await get_tree().create_timer(0.15).timeout
	if absf(library_reader.get_v_scroll_bar().value-stored)>1: return false
	await _qa_capture(out,"v16-independent-scroll")
	_action("libraryTop")
	if library_reader.get_v_scroll_bar().value!=0: return false
	# Exercise native input dispatch: Ctrl+F, digit typed into search, Escape, F1 and Tab/Enter.
	var key=InputEventKey.new()
	key.pressed=true
	key.ctrl_pressed=true
	key.keycode=KEY_F
	Input.parse_input_event(key)
	await get_tree().process_frame
	if not library_search.has_focus(): return false
	key=InputEventKey.new()
	key.pressed=true
	key.keycode=KEY_1
	key.unicode=49
	Input.parse_input_event(key)
	await get_tree().process_frame
	if screen!="library" or not "1" in library_search.text: return false
	key=InputEventKey.new()
	key.pressed=true
	key.keycode=KEY_ESCAPE
	Input.parse_input_event(key)
	await get_tree().process_frame
	if library_search.has_focus() or screen!="library": return false
	_action("libraryClear")
	focus_id="libraryCategory:battle"
	key=InputEventKey.new()
	key.pressed=true
	key.keycode=KEY_ENTER
	_unhandled_key_input(key)
	if library_category!="battle": return false
	_action("libraryRelated","cores")
	_action("libraryGo","campaign")
	if screen!="campaign" or campaign_mode!="dungeon": return false
	key=InputEventKey.new()
	key.pressed=true
	key.keycode=KEY_F1
	_unhandled_key_input(key)
	if screen!="library" or library_origin!="campaign": return false
	_action("nav:libraryReturn",library_origin)
	if screen!="campaign": return false
	# Reading must preserve an unconfirmed deployment and its edited draft.
	campaign_mode="stage"
	selected_stage=0
	_action("training")
	if screen!="deployment": return false
	var edited=draft.duplicate(true)
	_navigate("library")
	_action("nav:libraryReturn",library_origin)
	if screen!="deployment" or draft!=edited or deployment.is_empty(): return false
	_navigate("base")
	# Same snapshots/stock: catalog browsing never issues gameplay commands.
	if s.available!=inventory or s.arsenal.cores!=cores or s.seed!=seed: return false
	command({"type":"battle","stage":0,"training":true})
	await _settled()
	_action("battleReplay")
	battle_paused=false
	var before_step=battle_index
	_navigate("library")
	await get_tree().create_timer(0.2).timeout
	if not battle_paused or battle_index!=before_step: return false
	_action("nav:libraryReturn",library_origin)
	if screen!="battle" or battle_paused: return false
	_action("battleSkip")
	if not settlement_visible: return false
	_navigate("library")
	_action("libraryCategory:all","all")
	for size_px in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		DisplayServer.window_set_size(size_px)
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			for article in ["initiative","hit-evasion","research","auras-counters"]:
				_library_choose(article)
				_action("libraryTop")
				await _qa_capture(out,"v16-library-%s-%dx%d-%d"%[article,size_px.x,size_px.y,roundi(scale_value*100)])
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	await _qa_capture(out,"v16-library-fullscreen")
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(1280,720))
	ui_scale=1.0
	_library_choose("initiative")
	_action("libraryTop")
	var status={"categories":7,"articles":26,"search":"pass","scroll_isolation":"pass","keyboard":"pass","deployment_preserved":"pass","battle_pause_return":"pass","inventory_cores_seed_unchanged":"pass","resolutions":4,"scales":[100,120]}
	FileAccess.open(out.path_join("library.json"),FileAccess.WRITE).store_string(JSON.stringify(status,"  "))
	print("V16_LIBRARY_PASS: ",JSON.stringify(status))
	return true

func _v15_qa(out):
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v15-save.json"))})
	await _settled()
	print("V15_QA: repair confirmation and prepaid jobs")
	_navigate("repair")
	if info.repairAll.count!=15: return false
	await _qa_capture(out,"v15-repair-pending")
	command({"type":"repair","unitId":"tank_t7","count":2})
	await _settled()
	var q=info.repairAll.duplicate(true)
	if q.prepaid!=2 or q.count!=15: return false
	var crystal=s.wallet.crystal
	var inventory=s.available.duplicate(true)
	_action("repairAll")
	if not confirm_dialog.visible or not "立即" in confirm_dialog.dialog_text: return false
	await _qa_capture(out,"v15-repair-confirm")
	_cancel_action()
	confirm_dialog.hide()
	if s.wallet.crystal!=crystal or s.available!=inventory: return false
	_action("repairAll")
	_confirm_action()
	await _settled()
	if info.repairAll.count!=0 or s.wallet.crystal!=crystal-q.cost.crystal: return false
	for row in q.rows:
		if s.available[row.unitId]!=inventory[row.unitId]+row.count: return false
	await _qa_capture(out,"v15-repair-complete")
	print("V15_QA: mainline dual rewards and settlement recovery")
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v15-save.json"))})
	await _settled()
	if catalog.dungeons.size()!=16 or info.dungeonStatus[1].block=="": return false
	var cores=s.arsenal.cores.duplicate(true)
	command({"type":"dungeon","dungeonId":"core-0"})
	await _settled()
	_action("battleSkip")
	if not settlement_visible or report.winner!=0 or report.coreRewards.get("tank_core6")!=10 or report.coreRewards.get("tank_core7")!=2:
		print("V15_FAILED: first reward",settlement_visible,report.winner,report.get("coreRewards"))
		return false
	if s.arsenal.cores.tank_core6!=cores.tank_core6+10 or s.arsenal.cores.tank_core7!=cores.tank_core7+2: return false
	if info.dungeonStatus[1].block!="": return false
	await _qa_capture(out,"v15-settlement-repair")
	var historical_losses=report.casualties.duplicate(true)
	_action("repairAll")
	_confirm_action()
	await _settled()
	if info.repairAll.count!=0 or report.casualties!=historical_losses: return false
	cores=s.arsenal.cores.duplicate(true)
	_action("battleReplay")
	_action("battleSkip")
	await _settled()
	if s.arsenal.cores!=cores: return false
	_action("rematch")
	await _settled()
	_action("battleSkip")
	if report.coreRewards.tank_core6<2 or report.coreRewards.tank_core6>4 or report.coreRewards.tank_core7<0 or report.coreRewards.tank_core7>1: return false
	print("V15_QA: attributes, restored core artwork and window sizes")
	var original_size=get_window().size
	var captures=[]
	selected_class=0
	tier=7
	inventory_category="cores"
	inventory_owned=false
	for window_size in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=window_size
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			for page in ["attributes","campaign","inventory","repair"]:
				_navigate(page)
				if page=="campaign":
					campaign_mode="dungeon"
					selected_dungeon=15 if scale_value==1.2 else 0
				if page=="attributes": attribute_scope="ceiling" if scale_value==1.2 else "unit"
				await _qa_capture(out,"v15-%s-%dx%d-%d"%[page,window_size.x,window_size.y,int(scale_value*100)])
				captures.append({"page":page,"window":[get_window().size.x,get_window().size.y],"scale":scale_value})
				if page=="campaign" and buttons.filter(func(b):return b.id.begins_with("dungeon:")).size()!=20: return false
				if page=="repair":
					var repair_button=buttons.filter(func(b):return b.id=="repairAll")[0]
					var back_button=buttons.filter(func(b):return b.id=="nav:industry")[0]
					if repair_button.rect.intersects(back_button.rect): return false
				if page=="attributes":
					var sheet=info.attributes[attribute_scope] if attribute_scope!="unit" else info.attributes.byUnit[_unit_id()]
					var total=sheet.base+sheet.get("capacity",0)
					for row in sheet.rows: total+=row.delta
					if total!=sheet.power: return false
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	_navigate("attributes")
	_action("attributeScope:formation","formation")
	await _qa_capture(out,"v15-mixed-attributes")
	_action("attributeRules")
	await _qa_capture(out,"v15-attribute-rules")
	details_dialog.hide()
	_navigate("objectives")
	_action("fullBudget")
	await _settled()
	if not "随机" in details_text.text: return false
	await _qa_capture(out,"v15-core-budget")
	details_dialog.hide()
	get_window().size=original_size
	FileAccess.open(out.path_join("v15-regression.json"),FileAccess.WRITE).store_string(JSON.stringify({"instant_all_repair_cancel_confirm":"pass","prepaid_no_double_charge":"pass","settlement_repair_history_unchanged":"pass","sequential_unlock":"pass","dual_first_rewards":"pass","random_repeat_ranges":"pass","replay_no_rewards":"pass","power_ledger_exact":"pass","restored_core_art":"pass","captures":captures},"  "))
	return true

func _v14_qa(out):
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v14-save.json"))})
	await _settled()
	if catalog.stages.size()!=112 or catalog.chapters.size()!=7: return false
	_navigate("campaign")
	_action("campaignMode:stage","stage")
	_action("chapter:6",6)
	if selected_stage!=96: return false
	selected_stage=111
	await _qa_capture(out,"v14-chapter-seven")
	if buttons.filter(func(b):return b.id.begins_with("stage:")).size()!=16: return false
	_navigate("army")
	_action("formationPower")
	await _settled()
	if _formation_power(draft,true)!=int(info.power.readyMax): return false
	_action("formationTier")
	await _settled()
	if draft.any(func(st):return st!=null and catalog.units[st.unitId].tier!=7): return false
	_action("counterDetails")
	if not "+25%" in details_text.text or not "-20%" in details_text.text: return false
	await _qa_capture(out,"v14-counter-matrix")
	details_dialog.hide()
	_navigate("commandTraining")
	leadership_attempts=1
	var gold=s.wallet.gold
	var books=s.commander.books
	_action("buyBooks")
	if not confirm_dialog.visible or not "19" in confirm_dialog.dialog_text: return false
	_cancel_action()
	confirm_dialog.hide()
	if s.wallet.gold!=gold or s.commander.books!=books: return false
	_action("buyBooks")
	_confirm_action()
	await _settled()
	if s.wallet.gold!=gold-19 or s.commander.books!=books+1: return false
	leadership_attempts=10
	_action("trainGold")
	await _qa_capture(out,"v14-upgrade-confirm")
	_confirm_action()
	await _settled()
	if s.commander.leadership!=11 or s.wallet.gold!=gold-38 or s.lastLeadership.attempts!=1 or s.commander.books!=books+1: return false
	var initial_power=info.power.ceiling
	for id in ["initiativeSkill","extraFireSkill"]:
		_action(id)
		await _settled()
	if info.power.ceiling<=initial_power or info.unitStats.tank_t1.initiative!=103: return false
	# Retry runs a new formal battle from currently usable saved troops, without deployment.
	for target in [{"type":"battle","stage":0},{"type":"dungeon","dungeonId":catalog.dungeons[0].id}]:
		command(target)
		await _settled()
		if screen!="battle": return false
		_action("battleSkip")
		if not _battle_done() or not settlement_visible or not report.has("summary"): return false
		var old_id=report.id
		var old_books=s.commander.books
		_action("rematch")
		await _settled()
		if screen!="battle" or report.id==old_id or report.winner!=0 or s.commander.books!=old_books+1: return false
		battle_paused=true
		var settled_books=s.commander.books
		_action("battleSkip")
		_action("battleReplay")
		await _settled()
		if s.commander.books!=settled_books: return false
		_action("battleSkip")
	await _qa_capture(out,"v14-retry-settlement")
	# True independent failures: 300 unsuccessful attempts, no threshold guarantee.
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v14-probability-save.json"))})
	await _settled()
	_navigate("commandTraining")
	books=s.commander.books
	leadership_attempts=100
	for i in range(3):
		_action("trainBooks")
		_confirm_action()
		await _settled()
		if s.commander.leadership!=119 or s.lastLeadership.success: return false
	if s.commander.books!=books-300 or info.leadershipQuote.chance!=10: return false
	await _qa_capture(out,"v14-independent-failures")
	var original_size=get_window().size
	var captures=[]
	for window_size in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=window_size
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			for page in ["campaign","commandTraining","army","doctrine"]:
				_navigate(page)
				if page=="campaign": _action("campaignMode:stage","stage")
				await _settled()
				await _qa_capture(out,"v14-%s-%dx%d-%d"%[page,window_size.x,window_size.y,int(scale_value*100)])
				if page=="campaign" and buttons.filter(func(b):return b.id.begins_with("stage:")).size()!=16: return false
				captures.append({"page":page,"window":[get_window().size.x,get_window().size.y],"scale":scale_value})
	# A complete step includes the extra attack and then stops before the opponent.
	var fixtures=JSON.parse_string(FileAccess.get_file_as_string(out.path_join("v10-fixtures.json")))
	open_report(fixtures.extra)
	_step_action()
	if not last_hit.get("extra",false) or pending_hit or report.events[battle_index].side==0: return false
	open_report(JSON.parse_string(FileAccess.get_file_as_string(out.path_join("v14-asymmetric.json"))))
	battle_paused=true
	for i in range(3): _step_action()
	if last_hit.round!=1 or last_hit.side!=1 or last_hit.from!=2: return false
	await _qa_capture(out,"v14-asymmetric-turns")
	_report_details()
	if not "少阵位一方等待" in details_text.text: return false
	await _qa_capture(out,"v14-round-log")
	details_dialog.hide()
	ui_scale=1.0
	get_window().size=original_size
	FileAccess.open(out.path_join("v14-regression.json"),FileAccess.WRITE).store_string(JSON.stringify({"chapters":7,"stages":112,"power_and_tier_arrangement":"pass","counter_percentages":"pass","purchase_cancel_and_19gold":"pass","batch_success_actual_cost":"pass","commander_tactics_power":"pass","retry_without_deployment":"pass","replay_no_rewards":"pass","independent_300_failures":"pass","step_includes_combo":"pass","short_side_waits":"pass","captures":captures},"  "))
	return true

func _v13_qa(out):
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v13-save.json"))})
	await _settled()
	_set_quantity(10)
	_navigate("repair")
	if repair_unit!="tank_t1" or quantity!=7 or quantity_input.text!="7":
		print("V13_FAILED: default repair quantity",repair_unit,quantity)
		return false
	_set_quantity(10)
	if not "超出 3" in _disabled_reason("repairStart",null): return false
	request({"op":"tick"})
	await _settled()
	if quantity!=10: return false
	await _qa_capture(out,"v13-repair-invalid")
	_action("repairUnit:tank_destroyer_t1","tank_destroyer_t1")
	if quantity!=6: return false
	_action("repairUnit:tank_t1","tank_t1")
	var available=s.available.tank_t1
	_action("repairStart")
	await _settled()
	if quantity!=0 or s.damaged.tank_t1!=0: return false
	_action("rest:60",60)
	await _settled()
	if not confirm_dialog.visible or rest_preview.repaired!=7: return false
	await _qa_capture(out,"v13-rest-preview")
	_confirm_action()
	await _settled()
	if s.available.tank_t1!=available+7 or progress_report.repaired!=7: return false
	_navigate("repair")
	_action("repairUnit:tank_destroyer_t1","tank_destroyer_t1")
	if quantity!=6: return false
	_action("repairMax")
	if quantity!=6: return false
	available=s.available.tank_destroyer_t1
	_action("repairStart")
	await _settled()
	command({"type":"rest","minutes":60})
	await _settled()
	if s.available.tank_destroyer_t1!=available+6 or s.damaged.tank_destroyer_t1!=0: return false
	# Freeze archive row identity while a newer record arrives.
	_navigate("reports")
	var first=report_rows[0].id
	command({"type":"battle","stage":0,"training":true})
	await _settled()
	screen="reports"
	if report_rows[0].id!=first or s.reports[0].id==first: return false
	report_type="dungeon"
	if _filtered_reports().size()!=1 or _filtered_reports()[0].coreRewards.is_empty(): return false
	report_type="all"
	report_result="loss"
	if not _filtered_reports().all(func(r):return r.winner==1): return false
	report_result="all"
	_action("reportRefresh")
	if report_rows[0].id!=s.reports[0].id: return false
	# Native preset management routes and an old save without honors.
	command({"type":"presetSave","name":"战斗预设"})
	await _settled()
	command({"type":"presetSave","name":"采集预设"})
	await _settled()
	_navigate("presets")
	_action("presetRename",0)
	name_input.text="装甲突击队"
	_text_confirmed()
	text_dialog.hide()
	await _settled()
	if s.presets[0].name!="装甲突击队": return false
	draft[0]=null
	dirty=true
	_action("presetLoad:0",0)
	if not confirm_dialog.visible or not dirty: return false
	_cancel_action()
	confirm_dialog.hide()
	if draft[0]!=null or not dirty: return false
	_action("presetLoad:0",0)
	_confirm_action()
	await _settled()
	if dirty or draft[0]==null: return false
	var original_size=get_window().size
	request({"op":"import","text":FileAccess.get_file_as_string(out.path_join("v13-save.json"))})
	await _settled()
	command({"type":"presetSave","name":"装甲突击队"})
	await _settled()
	selected_building="hq"
	var captures=[]
	for window_size in [Vector2i(1180,680),Vector2i(1280,720),Vector2i(1920,1080),Vector2i(2560,1440)]:
		get_window().size=window_size
		for scale_value in [1.0,1.2]:
			ui_scale=scale_value
			for page in ["repair","reports","objectives","presets","army","base","world"]:
				_navigate(page)
				await _settled()
				await _qa_capture(out,"v13-%s-%dx%d-%d"%[page,window_size.x,window_size.y,int(scale_value*100)])
				captures.append({"page":page,"window":[get_window().size.x,get_window().size.y],"scale":scale_value})
	get_window().size=Vector2i(1280,720)
	ui_scale=1.0
	screen="objectives"
	_action("fullBudget")
	await _settled()
	if not details_dialog.visible or not "按均值估算" in details_text.text: return false
	await _qa_capture(out,"v13-core-budget")
	details_dialog.hide()
	_navigate("world")
	_action("scout")
	await _settled()
	_action("scoutDetails")
	if not "阵位 6" in details_text.text: return false
	await _qa_capture(out,"v13-scout-details")
	details_dialog.hide()
	get_window().size=Vector2i(1180,680)
	ui_scale=1.2
	_begin_world_deployment("gather")
	await _qa_capture(out,"v13-deployment-small")
	deployment_enemy=true
	await _qa_capture(out,"v13-enemy-small")
	_action("deploymentCancel")
	_action("rest:60",60)
	await _settled()
	await _qa_capture(out,"v13-rest-preview-small")
	_cancel_action()
	confirm_dialog.hide()
	open_report(JSON.parse_string(FileAccess.get_file_as_string(out.path_join("v12-battle.json"))))
	battle_paused=true
	_step_action()
	await _qa_capture(out,"v13-battle-small")
	_action("battleSkip")
	await _qa_capture(out,"v13-settlement-small")
	ui_scale=1.0
	# Test desktop fullscreen transition without touching the player's preferences.
	_toggle_fullscreen()
	await get_tree().create_timer(0.2).timeout
	await _qa_capture(out,"v13-fullscreen")
	_toggle_fullscreen()
	get_window().size=original_size
	FileAccess.open(out.path_join("v13-regression.json"),FileAccess.WRITE).store_string(JSON.stringify({"repair_7_then_6":"pass","manual_overlimit_reason":"pass","rest_preview_and_completion":"pass","archive_anchor_and_filters":"pass","preset_rename":"pass","budget":"pass","intel_details":"pass","fullscreen":"pass","captures":captures},"  "))
	return true
