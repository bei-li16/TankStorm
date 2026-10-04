extends ScrollContainer

# Stable native rows keep their scroll/focus position while countdowns and balances update.
var host
var rows: Dictionary = {}
var column = VBoxContainer.new()
var update_key = ""

func _ready():
	position = Vector2(1207,215)
	size = Vector2(377,554)
	horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	follow_focus = true
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation",10)
	add_child(column)
	var rail=StyleBoxFlat.new()
	rail.bg_color=Color("293e38")
	rail.set_content_margin_all(5)
	get_v_scroll_bar().add_theme_stylebox_override("scroll",rail)
	for key in ["grabber","grabber_highlight","grabber_pressed"]:
		var thumb=StyleBoxFlat.new()
		thumb.bg_color=Color("aa955d")
		thumb.set_content_margin_all(5)
		get_v_scroll_bar().add_theme_stylebox_override(key,thumb)

func _label(parent,heavy=false):
	var label=Label.new()
	label.text_overrun_behavior=TextServer.OVERRUN_TRIM_ELLIPSIS
	label.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	label.mouse_filter=Control.MOUSE_FILTER_PASS
	if heavy: label.add_theme_font_override("font",host.bold)
	parent.add_child(label)
	return label

func _button(parent,id,data):
	var button=Button.new()
	button.custom_minimum_size=Vector2(0,34)
	button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	button.clip_text=true
	button.set_meta("action",id)
	button.set_meta("data",data)
	for key in ["normal","hover","pressed","disabled","focus"]:
		var style=host.theme.get_stylebox(key,"Button").duplicate()
		style.set_content_margin_all(4)
		button.add_theme_stylebox_override(key,style)
	button.pressed.connect(func():
		if not host._command_pending(): host._action(button.get_meta("action"),button.get_meta("data")))
	parent.add_child(button)
	return button

func _add_row(id):
	var panel=PanelContainer.new()
	panel.custom_minimum_size=Vector2(0,175)
	panel.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	var style=StyleBoxFlat.new()
	style.bg_color=Color("172522")
	style.border_color=Color("3b4c47")
	style.set_border_width_all(1)
	style.set_content_margin_all(10)
	panel.add_theme_stylebox_override("panel",style)
	column.add_child(panel)
	var box=VBoxContainer.new()
	box.add_theme_constant_override("separation",7)
	panel.add_child(box)
	var title=_label(box,true)
	var cost=_label(box)
	var actions=HBoxContainer.new()
	actions.add_theme_constant_override("separation",8)
	box.add_child(actions)
	var upgrade=_button(actions,"constructUpgrade:"+id,id)
	var view=_button(actions,"constructView:"+id,id)
	view.text="设施详情 →"
	var footer=HBoxContainer.new()
	footer.custom_minimum_size.y=37
	footer.add_theme_constant_override("separation",6)
	box.add_child(footer)
	var status=_label(footer)
	var speed=_button(footer,"",null)
	speed.custom_minimum_size.x=151
	speed.size_flags_horizontal=Control.SIZE_SHRINK_END
	rows[id]={"title":title,"cost":cost,"upgrade":upgrade,"view":view,"status":status,"speed":speed}

func sync():
	visible=host.screen=="base" and host.base_panel=="construction" and not host.s.is_empty() and not host._modal_open()
	if not visible: return
	var key=str(host.s.revision)+":"+str(host._command_pending())+":"+str(host.ui_scale)
	if key==update_key: return
	update_key=key
	for row in host.info.construction:
		if not rows.has(row.id): _add_row(row.id)
		var parts=rows[row.id]
		var maxed=row.level>=host.catalog.MAX_LEVEL
		var block=host._construction_block(row)
		parts.title.text=row.name+" · Lv.%d%s"%[row.level," / 满级" if maxed else ""]
		parts.cost.text="已满级 · 可查看设施收益" if maxed else "施工中" if row.booked!=null else "升级 %s · %s"%[host._eta(row.duration),host._cost_text(row.cost)]
		parts.cost.tooltip_text=parts.cost.text
		parts.cost.add_theme_color_override("font_color",host.GOLD)
		parts.upgrade.text="施工中" if row.booked!=null else "已满级" if maxed else "直接升级"
		parts.upgrade.disabled=block!="" or host._command_pending()
		parts.upgrade.tooltip_text=block if block!="" else "点击立即扣除显示的材料并开始施工"
		parts.speed.visible=row.booked!=null
		parts.status.text=block if block!="" else "可直接升级，也可查看设施"
		parts.status.add_theme_color_override("font_color",host.MUTED)
		if row.booked!=null:
			parts.status.text="剩余 "+host._time(row.booked.remainingMs)
			parts.status.add_theme_color_override("font_color",host.GREEN)
			parts.speed.text="免费完成" if row.booked.acceleration==0 else "%s 金币加速"%host._amount(row.booked.acceleration)
			parts.speed.tooltip_text="立即完成，消耗 %d 金币"%row.booked.acceleration
			parts.speed.set_meta("action","accelerate:"+str(int(row.booked.seq)))
			parts.speed.set_meta("data",{"seq":row.booked.seq})
			parts.speed.disabled=host.s.wallet.gold<row.booked.acceleration or host._command_pending()
		parts.status.tooltip_text=parts.status.text
		for name in ["title","cost","status","upgrade","view","speed"]:
			parts[name].add_theme_font_size_override("font_size",int(round((19 if name=="title" else 17 if name in ["upgrade","view"] else 14)*host.ui_scale)))
