extends RefCounted

static func compact(value) -> String:
	var number = int(value)
	var magnitude = absi(number)
	var suffix = ["", "K", "M", "G", "T"]
	var index = 0
	var divisor: int = 1
	while index < 4 and magnitude >= divisor * 1000:
		index += 1
		divisor *= 1000
	var whole = int(magnitude / divisor)
	var fraction = "%02d" % int((magnitude % divisor) * 100 / divisor)
	fraction = fraction.trim_suffix("0").trim_suffix("0")
	return ("-" if number < 0 else "") + str(whole) + ("." + fraction if fraction != "" else "") + suffix[index]

static func exact(value) -> String:
	var number = int(value)
	var digits = str(absi(number))
	var result = ""
	while digits.length() > 3:
		result = "," + digits.right(3) + result
		digits = digits.left(digits.length() - 3)
	return ("-" if number < 0 else "") + digits + result
