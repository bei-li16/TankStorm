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
	column.add_theme_constant_override("separation",5)
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
	button.custom_minimum_size=Vector2(0,28)
	button.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	button.clip_text=true
	button.set_meta("action",id)
	button.set_meta("data",data)
	for key in ["normal","hover","pressed","disabled","focus"]:
		var style=host.theme.get_stylebox(key,"Button").duplicate()
		style.set_content_margin_all(4)
		style.content_margin_top=2
		style.content_margin_bottom=2
		button.add_theme_stylebox_override(key,style)
	button.pressed.connect(func():
		if not host._command_pending(): host._action(button.get_meta("action"),button.get_meta("data")))
	parent.add_child(button)
	return button

func _add_row(id):
	var panel=PanelContainer.new()
	panel.custom_minimum_size=Vector2(0,110)
	panel.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	var style=StyleBoxFlat.new()
	style.bg_color=Color("172522")
	style.border_color=Color("3b4c47")
	style.set_border_width_all(1)
	style.set_content_margin_all(4)
	panel.add_theme_stylebox_override("panel",style)
	column.add_child(panel)
	var box=VBoxContainer.new()
	box.add_theme_constant_override("separation",3)
	panel.add_child(box)
	var header=HBoxContainer.new()
	header.add_theme_constant_override("separation",4)
	box.add_child(header)
	var title=_label(header,true)
	var status=_label(header)
	status.custom_minimum_size.x=104
	status.size_flags_horizontal=Control.SIZE_SHRINK_END
	status.horizontal_alignment=HORIZONTAL_ALIGNMENT_RIGHT
	var effect=_label(box)
	var cost=_label(box)
	cost.text_overrun_behavior=TextServer.OVERRUN_NO_TRIMMING
	cost.max_lines_visible=2
	var actions=HBoxContainer.new()
	actions.add_theme_constant_override("separation",6)
	box.add_child(actions)
	var primary=VBoxContainer.new()
	primary.size_flags_horizontal=Control.SIZE_EXPAND_FILL
	actions.add_child(primary)
	var upgrade=_button(primary,"constructUpgrade:"+id,id)
	var speed=_button(primary,"",null)
	speed.hide()
	var view=_button(actions,"constructView:"+id,id)
	view.text="设施详情 →"
	rows[id]={"panel":panel,"title":title,"effect":effect,"cost":cost,"upgrade":upgrade,"view":view,"status":status,"speed":speed}

func _compact_cost(cost):
	var values=[]
	for resource in host.RES:
		if cost.get(resource,0)>0:
			values.append(host.catalog.resourceNames[resource]+" "+host._amount(cost[resource]))
	if values.is_empty(): return "无需材料\n "
	# Two deliberate lines keep every material visible without variable row heights.
	return " · ".join(values.slice(0,3))+"\n"+(" · ".join(values.slice(3)) if values.size()>3 else " ")

func _row_scale(parts):
	for name in ["title","effect","cost","status","upgrade","view","speed"]:
		parts[name].add_theme_font_size_override("font_size",int(round((17 if name=="title" else 14 if name in ["upgrade","view","speed"] else 12)*host.ui_scale)))
	# Reserve both material lines even for projects with fewer resource types.
	parts.cost.custom_minimum_size.y=ceil(32*host.ui_scale)
	parts.effect.custom_minimum_size.y=ceil(17*host.ui_scale)

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
		parts.effect.text="已满级 · 收益持续生效" if maxed else "升至 %d 级 · 工时 %s"%[row.level+1,host._time(host._effective_time(row.booked.duration) if row.booked!=null else row.duration)]
		parts.effect.add_theme_color_override("font_color",host.GOLD)
		parts.effect.tooltip_text=parts.effect.text
		var cost=row.booked.unitCost if row.booked!=null else row.cost
		parts.cost.text="满级设施无需再升级\n " if maxed else _compact_cost(cost)
		parts.cost.tooltip_text=("已付材料：" if row.booked!=null else "所需材料：")+host._cost_text(cost)
		parts.cost.add_theme_color_override("font_color",host.TEXT)
		parts.upgrade.text="施工中" if row.booked!=null else "已满级" if maxed else "直接升级"
		parts.upgrade.disabled=block!="" or host._command_pending()
		parts.upgrade.tooltip_text=block if block!="" else "点击立即扣除显示的材料并开始施工"
		parts.speed.visible=row.booked!=null
		parts.upgrade.visible=not parts.speed.visible
		parts.status.text=block if block!="" else "可升级"
		parts.status.add_theme_color_override("font_color",host.GOLD if maxed else host.RED if block!="" else host.MUTED)
		if row.booked!=null:
			parts.status.text="剩余 "+host._time(row.booked.remainingMs)
			parts.status.add_theme_color_override("font_color",host.GREEN)
			parts.speed.text="免费完成" if row.booked.acceleration==0 else "%s 金币加速"%host._amount(row.booked.acceleration)
			parts.speed.tooltip_text="立即完成，消耗 %d 金币"%row.booked.acceleration
			parts.speed.set_meta("action","accelerate:"+str(int(row.booked.seq)))
			parts.speed.set_meta("data",{"seq":row.booked.seq})
			parts.speed.disabled=host.s.wallet.gold<row.booked.acceleration or host._command_pending()
		parts.status.tooltip_text=parts.status.text
		_row_scale(parts)
