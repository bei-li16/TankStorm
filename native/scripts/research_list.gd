extends "res://scripts/construction_list.gd"

# Reuse the stable scroll/row controls, while research keeps its own scroll and job state.
func _add_row(id):
	super._add_row(id)
	var parts=rows[id]
	parts.upgrade.set_meta("action","dispatchResearch:"+id)
	parts.view.set_meta("action","dispatchTechView:"+id)
	parts.view.text="科技详情 →"

func sync():
	visible=host.screen=="base" and host.base_panel=="research" and not host.s.is_empty() and not host._modal_open()
	if not visible: return
	var key=str(host.s.revision)+":"+str(host._command_pending())+":"+str(host.ui_scale)
	if key==update_key: return
	update_key=key
	for node in host.catalog.researchTree:
		if not rows.has(node.id): _add_row(node.id)
		var parts=rows[node.id]
		var quote=host.info.researchQuotes[node.id]
		var booked=quote.booked
		var maxed=host.s.tech[node.id]>=host.catalog.MAX_LEVEL
		var block=quote.block if quote.block!="" else "科研队列已满：1工作＋3等待" if host.info.queues.research.full else host._missing_resources(quote.unitCost)
		var cost=booked.unitCost if booked!=null else quote.unitCost
		parts.title.text=node.name+" · Lv.%d / %d"%[host.s.tech[node.id],host.catalog.MAX_LEVEL]
		var gain=host._research_gain_text(node.id,quote)
		var duration=host._time(host._effective_time(booked.duration) if booked!=null else quote.duration)
		parts.effect.text="收益 %.1f%% · 已满级"%quote.effectCurrent if maxed else "%.1f%% → %.1f%% · 工时 %s"%[quote.effectCurrent,quote.effectNext,duration]
		if node.id=="armorPlating":
			var level=int(host.s.tech[node.id])
			parts.effect.text="生命 %d→%d%% · 防御 %d→%d%% · %s"%[level*3,min(level+1,host.catalog.MAX_LEVEL)*3,level*2,min(level+1,host.catalog.MAX_LEVEL)*2,"满级" if maxed else duration]
		parts.effect.tooltip_text=host.catalog.techDescriptions[node.id]+"\n"+gain+(" · 已满级" if maxed else " · 工时 "+duration)
		parts.effect.add_theme_color_override("font_color",host.GOLD)
		parts.cost.text="满级效果持续生效\n " if maxed else _compact_cost(cost)
		parts.cost.tooltip_text=("已付材料：" if booked!=null else "所需材料：")+host._cost_text(cost)
		parts.cost.add_theme_color_override("font_color",host.TEXT)
		parts.upgrade.text="排队中" if booked!=null and booked.waiting else "研究中" if booked!=null else "已满级" if maxed else "直接研究"
		parts.upgrade.disabled=booked!=null or block!="" or host._command_pending()
		parts.upgrade.tooltip_text="材料已支付；完成前一项后自动开工" if booked!=null and booked.waiting else "项目正在研究" if booked!=null else block if block!="" else "点击扣除显示的材料并安排研究，无二次确认"
		parts.status.text=block if block!="" else "可研究"
		parts.status.add_theme_color_override("font_color",host.GOLD if maxed else host.RED if block!="" else host.MUTED)
		parts.speed.visible=booked!=null and not booked.waiting
		parts.upgrade.visible=not parts.speed.visible
		if booked!=null:
			parts.status.text="等待 "+host._time(booked.waitMs) if booked.waiting else "剩余 "+host._time(booked.remainingMs)
			parts.status.add_theme_color_override("font_color",host.GOLD if booked.waiting else host.GREEN)
			parts.speed.text="免费完成" if booked.acceleration==0 else "%s 金币加速"%host._amount(booked.acceleration)
			parts.speed.tooltip_text="金币不足，还缺 %s"%host._amount(booked.acceleration-host.s.wallet.gold) if host.s.wallet.gold<booked.acceleration else "点击立即完成当前研究，消耗 %d 金币；后续项目自动开工"%booked.acceleration
			parts.speed.set_meta("action","accelerate:research:"+str(int(booked.seq)))
			parts.speed.set_meta("data",{"seq":booked.seq})
			parts.speed.disabled=host.s.wallet.gold<booked.acceleration or host._command_pending()
		parts.status.tooltip_text=parts.status.text+(" · 预计完成 "+host._time(booked.remainingMs) if booked!=null else "")
		_row_scale(parts)
