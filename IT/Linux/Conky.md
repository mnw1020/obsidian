
**Измеряем температуру винтов**

sudo apt-get install hddtemp

```
sudo chmod u+s /usr/sbin/hddtemp
hddtemp /dev/sda

Измерение температуры процессора

```

```

sudo apt-get install lm-sensors
${execi 10 sensors | grep "CPU Temperature" | cut -c22-28}

Использование if_match
${if_match expr}
 True block
${else}
 False block
${endif}

```

```

```

---

```
Интерактивные conky - это не очень сложно

Сразу хочу предупредить, что я не профессиональный программист и поэтому буду всё объяснять так, как понимаю это сам, т.е. кухонным языком. Если Вы найдете ошибки, связанные с терминологией, то прошу сообщить для исправления ошибок. Итак начнем. Вот так примерно могут выглядеть и работать интерактивные conkyhttp://www.youtube.com/watch?v=8AD-huG3u5k
И начну я с того, что интерактивные, а также conky с использованием скриптов на языке lua, должны быть установлены как описано вhttp://www.crunchbang.org.ua/viewtopic.php?p=678#p678.
Интерактивные коньки основаны на отслеживании координат курсора. Для подключения такой возможности необходимо проверить наличие следующей программы.

xdotool_2.20110530.1

которая будет определять в каком месте нажата кнопка мышки. Не знаю как в других OS но в Crunchbang-10 и в Crunchbang-11 они есть в репах. Если их нет или в репах более старые версии, то необходимые пакеты можно взять на нестабильной ветке, в зависимости от вашего компа.

xdotool_2.20110530.1-3_amd64
xdotool_2.20110530.1-3_i386

или у меня в dropboxhttps://dl.dropbox.com/u/22038871/new.tar.gz

Затем необходимо отредактировать свой conkyrc. Я использовал стандартный conkyrc из Crunchbang, но можно взять любой. Не буду объяснять все строки conkyrc, для определения программой над каким окном находится курсор, надо дать окну conky имя. Оно может быть любым, я обозвал его interactive

Строка в conkyrc должна выглядеть так

```

Код: [Выделить]

```

```

```
own_window_title interactive
```

```

и ещё редактируем тип окна, программа работает только в режиме normal

```

Код: [Выделить]

```

```

```
own_window_type normal
```

```

Редактирование conkyrc на данном этапе закончено.

Переходим к созданию скрипта, который будет отслеживать перемещение курсора и щелчки кнопкой мышки. Я обычно не пишу всё в одном скрипте, легче использовать несколько небольших скриптов, чем ползать по длинному скрипту выискивая где напорол. Да и заменить, например часы со стрелками на цифровые, можно сменой маленького скрипта, а не переписывать все заново.

Скрипт можно назвать любым именем, лучше, чтобы по имени можно было определить, что этот скрипт делает. Свой я назвал clickfunction.lua

Итак в файловом менеджере создаем папку scripts и в этой папке создаем пустой текстовый файл и сохраняем его под выбранным именем. Далее щелкаем мышкой по этому файлу, в меню выбираем "Свойства", в открывшемся окне выбираем вкладку "Права" и щелкаем по кнопке "Разрешить запуск этого файла как программы". Можно конечно написать скрипт в редакторе и из редактора создать папку и сохранить в ней скрипт, но обязательно необходимо всем созданным скриптам давать права на исполнение.

Открываем файл в редакторе, я использую Geany, и вносим туда следующие строки, можно просто скопировать.

```

Код: [Выделить]

```

```

```
function clickfunction()

	record_start=1
	conky_record()

	local f = io.popen("xwininfo -name 'interactive' | grep 'Absolute'")
	local geometry = f:read("*a")
	f:close()
	local geometry = string.gsub(geometry,"[\n]","")
	s,f,abstlx = string.find(geometry,"X%p%s*(%d*)")
	s,f,abstly = string.find(geometry,"Y%p%s*(%d*)")
	local f = io.popen("xdotool getmouselocation 2> /dev/null")
	mousenow = f:read()
	f:close()
	local s,f,mousenowx = string.find(mousenow,"x%p(%d*)%s")
	local s,f,mousenowy = string.find(mousenow,"y%p(%d*)%s")
	localnowx = tonumber(mousenowx)
	localnowy = tonumber(mousenowy)
	click_table[3] = localnowx-abstlx
	click_table[4] = localnowy-abstly
	local f = io.open("/tmp/xdo")
	click=f:read()
	f:close()
	if click~=nil then
		local f = io.open("/tmp/xdo","w")
		f:write("")
		f:close()
		click_table[1] = localnowx-abstlx
		click_table[2] = localnowy-abstly
	end
end
function conky_record()
	if record_start == 1 then
		xdot = conky_parse("${if_running xdotool}1${else}0${endif}")
		if tonumber(xdot) == 1 then
			os.execute("killall xdotool &")
		end
		os.execute("xdotool search --sync --classname 'conky' behave %@ mouse-click getmouselocation 2> /dev/null >> /tmp/xdo &")
		record_start=0
	end
	return ""
end

```

```
В этом скрипте, в зависимости от того, какое имя вы дали окну conky, необходимо тредактировать всего одну строку

```

Код: [Выделить]

```

```

```
local f = io.popen("xwininfo -name 'interactive' | grep 'Absolute'")
```

```

заменив interactive на имя из строки conkyrc

```

Код: [Выделить]

```

```

```
own_window_title interactive
```

```

Теперь переходим к созданию основного скрипта, котрый будет запускать всё, что нам будет нужно в наших коньках.
Снова создаём скрипт, я назвал свой start.lua и вписываем в него следующие строки (в конце статьи помещен полный текст для данного описания)

```

Код: [Выделить]

```

```

```
require "cairo"
require "imlib2"
```

```

эти строки необходимы для вывода текстов, рисунков, графиков
Далее идут строки которые позволят запускать эти конки под любым пользователем и на любом компе, конечно под linux, и к тому же эти строки позволяют запускать необходимые нам скрипты в любом количестве, итак пишем

```

Код: [Выделить]

```

```

```
usrhome = os.getenv("HOME")
```

```

эта строка определяет домашнюю директорию, далее подключаем созданный нами ранее скрипт отслеживающий действия мыши.

```

Код: [Выделить]

```

```

```
dofile (usrhome .. "/scripts/clickfunction.lua")
```

```

эта строка показывает программе откуда необходимо взять и подключить скрипт, если у вас скрипт хранится в другой папке, то пишете свой путь к скрипту, но папка со скриптами должна находиться в домашней директории.

Затем создаём базу в которой будут храниться координаты мыши (курсора) и координаты места на котором щелкнули мышкой.

```

Код: [Выделить]

```

```

```
-- создаем базу координат мыши
click_table = {}	-- click_table[1], click_table[2] - x,y клика мыши click_table[3], click_table[4] - x,y положения мыши
```

```

Далее пишем название функции, название может быть любое, например

```

Код: [Выделить]

```

```

```
function conky_main()
```

```

и команду для запуска функции слежения за мышкой

```

Код: [Выделить]

```

```

```
clickfunction()

```

```
Далее пишем обязательные строки необходимые для работы любых конки c использованием lua. Эти строки проверяют существует ли окно конки и передают размеры окна программе. Я их выделяю, чтобы по запарке случайно не стереть

```

Код: [Выделить]

```

```

```
-- =====================================================================
	if conky_window == nil then return end
	local cs = cairo_xlib_surface_create(conky_window.display, conky_window.drawable, conky_window.visual, conky_window.width, conky_window.height)
-- =====================================================================
```

```

Для проверки работоспособности созданной программы напишем несколько строк, которые будут выводить в терминал координаты перемещения и кликов мыши.

```

Код: [Выделить]

```

```

```
print("Координата x = "..click_table[3])
print("Координата y = "..click_table[4])
print("Клик x = "..click_table[1])
print("Клик y = "..click_table[2])
```

```

Ну и в конце закрываем скрипт

```

Код: [Выделить]

```

```

```
end
```

```

Сохраняем скрипт. Не забываем дать права.

Полный текст данного скрипта

```

Код: [Выделить]

```

```

```
require "cairo"
require "imlib2"

usrhome = os.getenv("HOME")
dofile (usrhome .. "/scripts/clickfunction.lua")

click_table = {}

function conky_main()

	clickfunction()

-- =====================================================================
	if conky_window == nil then return end
	local cs = cairo_xlib_surface_create(conky_window.display, conky_window.drawable, conky_window.visual, conky_window.width, conky_window.height)
-- =====================================================================

	print("Координата x = "..click_table[3])
	print("Координата y = "..click_table[4])
	print("Клик x = "..click_table[1])
	print("Клик y = "..click_table[2])

end

```

```
Теперь осталось добавить в conkyrc пару строк которые будут запускать всё это. Открываем в редакторе conkyrc и выше слова TEXT добавляем две строки

```

Код: [Выделить]

```

```

```
lua_load ~/scripts/start.lua
lua_draw_hook_pre main

```

```
Если в этих конках ниже слова TEXT не будет никаких командных строк, то необходима хотя бы одна пустая строка ниже слова TEXT, иначе коньки не поедут

Ещё один совет, пока затачиваете коньки, лучше включить в conkyrc вывод рамки окна коньков, легче затачивать будет, т.е. в строке conkyrc

```

Код: [Выделить]

```

```

```
draw_borders no
```

```

изменить no на yes

Теперь можно проверить работу. Открываем терминал и запускаем прописав свои пути

```

Код: [Выделить]

```

```

```
conky -c ~/путь_до_конкирка/conkyrc
```

```

и отслеживаем в терминале координаты мыши.

Небольшое предупреждение: после запуска коньков появляется сообщение об ошибке, это не страшно, после первого щелчка мышкой ошибка исчезает. Ошибка связана с тем, что при запуске отсутствуют данные о месте щелчка мышью.

Теперь надо определиться, что мы хотим сделать, то есть, что мы хотим видеть на столе и что мы будем переключать. Для начала просто создадим кнопку, которая будет изменять цвет рамки при наведении на неё курсора и закрашиваться при щелчке на кнопке.

Для создания кнопки потребуется небольшой скрипт, который будет выводить на экран прямоугольник. Этот скрипт может пригодиться для вывода рамок кнопок при разметки положения кнопок в создаваемых своих конках. С помощью этого скрипта я нарисовал вот такой приемник

http://storage8.static.itmages.ru/i/12/1221/s_1356083231_3322676_cf2cb0256d.png

Скрипт простой и содержит в себе две функции. Первая, можно сказать очень востребуемая, занимается перекодировкой цвета в понятный для коньков формат, ну а вторая рисует прямоугольники.

Создаем пустой текстовый файл и копируем в него следующий код, можете конечно вбить его и ручками.

```

Код: [Выделить]

```

```

```
-- перекодировка цвета
function rgb_to_r_g_b(colour, alpha)

return ((colour / 0x10000) % 0x100) / 255., ((colour / 0x100) % 0x100) / 255., (colour % 0x100) / 255., alpha

end
-- рисование рамок
function rounded_rect(cr, xFrame, yFrame, wFrame, hFrame, rFrame, thFrame, fgcFrame, fgaFrame, glass)
	cairo_move_to(cr, xFrame + rFrame, yFrame)
	cairo_line_to(cr, xFrame + wFrame - rFrame, yFrame)
	cairo_arc(cr, xFrame + wFrame - rFrame, yFrame + rFrame, rFrame, -math.pi/2,0)
	cairo_line_to(cr, xFrame + wFrame, yFrame + hFrame - rFrame)
	cairo_arc(cr, xFrame + wFrame - rFrame, yFrame + hFrame - rFrame, rFrame, 0, math.pi/2)
	cairo_line_to(cr, xFrame + rFrame, yFrame + hFrame)
	cairo_arc(cr, xFrame + rFrame, yFrame + hFrame - rFrame, rFrame, math.pi/2, math.pi)
	cairo_line_to(cr, xFrame, yFrame + rFrame)
	cairo_arc(cr, xFrame + rFrame, yFrame + rFrame, rFrame, math.pi, math.pi*1.5)
	cairo_set_source_rgba(cr, rgb_to_r_g_b(fgcFrame, fgaFrame))
	if glass == true then
		cairo_fill(cr)
	else
		cairo_set_source_rgba(cr, rgb_to_r_g_b(fgcFrame, fgaFrame))
		cairo_set_line_width (cr, thFrame)
		cairo_stroke(cr)
	end
end

```

```
Забыл сказать, что в скрипты можно вставлять комментарии. Если необходимо вставить большой комментарий, состоящий из нескольких строк, то сделать это можно в таком формате

```

Код: [Выделить]

```

```

```
--[[
несколько строк комментариев
]]
```

```

Если же комментарии не превышают длины строки, или просто в конце строки надо сделать короткую пометку, то перед комментарием ставятся два тире

```

Код: [Выделить]

```

```

```
-- короткий комментарий действует только до конца строки
```

```

Вернемся к созданному нами скрипту. Первая функция вызывается программно, в случае когда необходимо перекодировать цвет. Вторая функция вызывается строкой

```

Код: [Выделить]

```

```

```
rounded_rect(cr, координата x, координата y, ширина, высота, радиус, толщина линии, цвет, насыщенность цвета, заливка цветом)
```

```

-- координаты задаются от левой и верней границы окна conky
-- ширина и высота соответственно размеры выводимого прямоугольника
-- радиус, радиус закругления углов прямоугольника
-- толщина линии в пикселях
-- цвет в формате 0xFFFFFF или 0xffffff - разницы никакой и тот и другой выводит белый цвет
-- насыщенность цвета от 0 до 1 - чем меньше тем прозрачнее
-- заливка цветом - закрашивание прямоугольника

Если скрипт готов, то даем ему название и сохраняем в папке scripts, не забывайте дать ему права на исполнение. У меня этот скрипт имеет название collection_of_scripts.lua.

Теперь открываем в редакторе скрипт start.lua, который был создан в предыдущем посте, и вставляем в него отсутствующие строки, к сожалению при выводе кода невозможно изменить цвет строки.

```

Код: [Выделить]

```

```

```
require "cairo"
require "imlib2"

usrhome = os.getenv("HOME")
dofile (usrhome .. "/scripts/clickfunction.lua")
dofile (usrhome .. "/scripts/collection_of_scripts.lua")

click_table = {}

function conky_main()

	clickfunction()

-- =====================================================================
	if conky_window == nil then return end
	local cs = cairo_xlib_surface_create(conky_window.display, conky_window.drawable, conky_window.visual, conky_window.width, conky_window.height)
-- =====================================================================
	cr = cairo_create(cs)				-- красный

	rounded_rect(cr, 15, 15, 100, 50, 3, 4, 0x002233, 1, false)		-- красный

	print("Координата x = "..click_table[3])
	print("Координата y = "..click_table[4])
	print("Клик x = "..click_table[1])
	print("Клик y = "..click_table[2])

	cairo_stroke(cr)
	cairo_destroy(cr)
	cr = nil

end

```

```

Далее есть два варианта продолжения составления программы. Первый вариант - запустить созданную программу в терминале и подводя курсор ко всем сторонам прямоугольника записать координаты сторон. Второй вариант расчитать координаты сторон, прибавляя к координатам x и y ширину и высоту прямоугольника.

Первый способ предпочтительней для записи координат нескольких кнопок. Независимо от того каким способом мы получили координаты сторон прямоугольника, создаём скрипт который будет сравнивать координаты и клики мыши с координатами прямоугольника.

```

Код: [Выделить]

```

```

```
function buttons()

--	база координат кнопок основного меню
--	main_menu = {левая граница кнопки, правая граница кнопки, верхняя граница кнопки, нижняя граница кнопки ...... }
	main_menu = {75, 175, 75, 125}
-- =====================================================================
-- курсор над кнопкой
	if click_table[3] >= main_menu[1] and click_table[3] <= main_menu[2] and click_table[4] >= main_menu[3] and click_table[4] <= main_menu[4] then
		above_button = 1
	else
		above_button = 0
	end
-- =====================================================================
-- клик над кнопкой
	if click_table[1] == click_table[3] and click_table[2] == click_table[4] and above_button == 1 and button_click ~= 1 then
		button_click = 1
	elseif click_table[1] == click_table[3] and click_table[2] == click_table[4] and above_button == 1 and button_click == 1 then
		button_click = 0
	end
end

```

```
Называем созданный скрипт buttons.lua, сохраняем в папке scripts и не забываем дать права на исполнение.

Снова редактируем скрипт start.lua

```

Код: [Выделить]

```

```

```
require "cairo"
require "imlib2"

usrhome = os.getenv("HOME")
dofile (usrhome .. "/scripts/clickfunction.lua")
dofile (usrhome .. "/scripts/collection_of_scripts.lua")
dofile (usrhome .. "/scripts/buttons.lua")		-- красный

click_table = {}

function conky_main()

	clickfunction()
	buttons()		-- красный
-- =====================================================================
   if conky_window == nil then return end
   local cs = cairo_xlib_surface_create(conky_window.display, conky_window.drawable, conky_window.visual, conky_window.width, conky_window.height)
-- =====================================================================

	cr = cairo_create(cs)

	if above_button == 1 then			-- красный
		rounded_rect(cr, 75, 75, 100, 50, 3, 4, 0xff0000, 1, false)	-- красный
	elseif button_click == 1 then
		rounded_rect(cr, 75, 75, 100, 50, 3, 4, 0xff0000, 0.25, true)
	else
		rounded_rect(cr, 75, 75, 100, 50, 3, 4, 0xffffff, 1, false)
	end

   	cairo_stroke(cr)
	cairo_destroy(cr)
	cr = nil

end

```

```

После запуска в окне conky появится кнопка. Ну а как на эту кнопку задействовать команды расскажу в следующий раз.

```

```

```