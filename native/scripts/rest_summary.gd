extends Control

# Read-only overlay. Every mouse press closes it and is consumed, so the base
# underneath cannot accidentally start another rest or spend resources.
var host
var scroll: ScrollContainer
var body: VBoxContainer
var panel: PanelContainer

func _ready():
	z_index = 100
	mouse_filter = Control.MOUSE_FILTER_STOP
	size = Vector2(1600,900)
	var shade = ColorRect.new()
	shade.color = Color(0.01,0.025,0.02,0.72)
	shade.size = size
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	panel = PanelContainer.new()
	panel.position = Vector2(160,135)
	panel.size = Vector2(1280,630)
	var style = StyleBoxFlat.new()
	style.bg_color = Color("131f1c")
	style.border_color = Color("d7b776")
	style.set_border_width_all(2)
	style.content_margin_left = 24
	style.content_margin_right = 24
	style.content_margin_top = 18
	style.content_margin_bottom = 18
	panel.add_theme_stylebox_override("panel",style)
	add_child(panel)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation",12)
	panel.add_child(column)
	_label("休整结算",column,28,Color("d7b776"))
	scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	column.add_child(scroll)
	body = VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation",14)
	scroll.add_child(body)
	_label("收益已自动结算 · 点击任意处关闭 · 内容较多时可滚轮查看",column,16,Color("a8b8ab"))
	hide()

func _label(value, parent, font_size=18, tint=Color("ebe7dc")):
	var label = Label.new()
	label.text = value
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.add_theme_font_size_override("font_size",roundi(font_size*(host.ui_scale if host!=null else 1.0)))
	label.add_theme_color_override("font_color",tint)
	parent.add_child(label)
	return label

func _input(event):
	if not visible: return
	if (event is InputEventMouseButton and event.pressed and event.button_index in [MOUSE_BUTTON_LEFT,MOUSE_BUTTON_RIGHT,MOUSE_BUTTON_MIDDLE]) or (event is InputEventScreenTouch and event.pressed) or (event is InputEventKey and event.pressed and event.keycode in [KEY_ESCAPE,KEY_ENTER,KEY_SPACE]):
		hide()
		host.focus_id = ""
		get_viewport().set_input_as_handled()
	elif event is InputEventKey:
		get_viewport().set_input_as_handled()

func show_summary(owner_view, report):
	host = owner_view
	for child in body.get_children():
		body.remove_child(child)
		child.queue_free()
	_label("推进时间 "+host._time(report.elapsed)+" · 资源净入库（含自产与归队）",body,20,Color("d7b776"))
	var grid = GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation",28)
	grid.add_theme_constant_override("v_separation",8)
	body.add_child(grid)
	for i in range(6):
		var row = HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(row)
		var icon = TextureRect.new()
		var atlas = AtlasTexture.new()
		atlas.atlas = host.textures.resources
		var cell = Vector2(atlas.atlas.get_width()/3.0,atlas.atlas.get_height()/2.0)
		atlas.region = Rect2(Vector2(i%3,int(i/3))*cell,cell)
		icon.set_meta("resource_icon",true)
		icon.texture = atlas
		icon.custom_minimum_size = Vector2(52,52)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		row.add_child(icon)
		var id = host.RES[i]
		_label(host.catalog.resourceNames[id]+"\n"+("+" if report.resources[id]>=0 else "")+host._amount(report.resources[id]),row,20,Color("d7b776"))
	_label("制造 %d 辆   ·   改装 %d 辆   ·   修复 %d 辆"%[report.produced,report.refitted,report.repaired],body,20,Color("8fba86"))
	var capped: Array[String] = []
	for id in report.get("capacityLimited",[]): capped.append(host.catalog.resourceNames[id])
	_label("满仓影响："+("无" if capped.is_empty() else "、".join(capped)),body,17,Color("a8b8ab"))
	var sections = HBoxContainer.new()
	sections.add_theme_constant_override("separation",30)
	body.add_child(sections)
	var projects = VBoxContainer.new()
	projects.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sections.add_child(projects)
	_label("建设 %d 项 · 研究 %d 项"%[report.buildings.size(),report.research.size()],projects,21,Color("d7b776"))
	for item in report.buildings:
		_label(host.catalog.buildingNames.get(item.id,host.info.facilities.get(item.id,{}).get("name",item.id))+"  Lv.%d → %d"%[item.from,item.to],projects)
	for item in report.research: _label(host.catalog.techNames[item.id]+"  Lv.%d → %d"%[item.from,item.to],projects)
	if report.buildings.is_empty() and report.research.is_empty(): _label("本次没有建筑或科技升级完成",projects,17,Color("a8b8ab"))
	_label("未完成作业继续按队列计时。",projects,16,Color("a8b8ab"))
	var expeditions = VBoxContainer.new()
	expeditions.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sections.add_child(expeditions)
	_label("归队 %d 队 · 新交战 %d 场"%[report.returns.size(),report.battles.size()],expeditions,21,Color("d7b776"))
	for entry in report.returns:
		_label(entry.get("title",entry.targetId)+" · "+("归队" if entry.outcome=="returned" else "失败")+" · 生还%d"%entry.survivors,expeditions,18)
		var stored = host._cost_text(entry.get("stored",entry.cargo))
		var discarded = host._cost_text(entry.get("discarded",{}))
		_label("入库 "+(stored if stored!="" else "0")+"；丢弃 "+(discarded if discarded!="" else "0"),expeditions,16,Color("d7b776"))
		var losses = entry.get("losses")
		if losses!=null: _label("本次待修 %d / 永久损失 %d"%[losses.repairable,losses.destroyed],expeditions,16,Color("a8b8ab"))
	for battle in report.battles:
		_label(("胜利 · " if battle.winner==0 else "失败 · ")+battle.title+" · 待修%d / 永久%d"%[battle.repairable,battle.destroyed],expeditions,16,Color("8fba86") if battle.winner==0 else Color("de8771"))
	if report.returns.is_empty() and report.battles.is_empty(): _label("本次没有远征归队或新交战",expeditions,17,Color("a8b8ab"))
	scroll.scroll_vertical = 0
	show()
	_fit_panel.call_deferred()

func _fit_panel():
	await get_tree().process_frame
	await get_tree().process_frame
	var height=clampf(maxf(body.size.y,body.get_combined_minimum_size().y)+142,570*host.ui_scale,710)
	panel.size=Vector2(1280,height)
	panel.position=Vector2(160,(900-height)/2)
	# Wrapped labels settle through nested containers over several layout passes.
	for i in range(3):
		await get_tree().process_frame
		var overflow=maxf(0,scroll.get_v_scroll_bar().max_value-scroll.get_v_scroll_bar().page)
		if overflow>0:
			panel.size.y=minf(710,panel.size.y+overflow+8)
			panel.position.y=(900-panel.size.y)/2
