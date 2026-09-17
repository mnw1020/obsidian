const ENTITY_LINKS_BLOCK = "<!-- KINO:ENTITY:LINKS:V2 -->\n```dataviewjs\nconst KINO_GENRE_ALIASES = {\"Боевик\":[\"Action\",\"Боевик\"],\"Приключения\":[\"Adventure\",\"Приключения\"],\"Анимация\":[\"Animation\",\"Анимация\",\"Мультфильм\"],\"Биография\":[\"Biography\",\"Биография\"],\"Комедия\":[\"Comedy\",\"Комедия\"],\"Криминал\":[\"Crime\",\"Криминал\"],\"Документальный\":[\"Documentary\",\"Документальный\",\"Документальное\"],\"Драма\":[\"Drama\",\"Драма\"],\"Семейный\":[\"Family\",\"Семейный\"],\"Фэнтези\":[\"Fantasy\",\"Фэнтези\"],\"История\":[\"History\",\"История\"],\"Ужасы\":[\"Horror\",\"Ужасы\"],\"Музыка\":[\"Music\",\"Музыка\"],\"Мюзикл\":[\"Musical\",\"Мюзикл\"],\"Мистика\":[\"Mystery\",\"Мистика\"],\"Мелодрама\":[\"Romance\",\"Мелодрама\"],\"Фантастика\":[\"Sci-Fi\",\"Science Fiction\",\"Фантастика\"],\"Короткометражка\":[\"Short\",\"Short Film\",\"Короткометражка\"],\"Спорт\":[\"Sport\",\"Sports\",\"Спорт\"],\"Триллер\":[\"Thriller\",\"Триллер\"],\"Военный\":[\"War\",\"Военный\"],\"Реалити-шоу\":[\"Reality-TV\",\"Reality TV\",\"Реалити-шоу\"],\"Вестерн\":[\"Western\",\"Вестерн\"]};\nconst KINO_ENTITY_FIELDS = [\n    [\"Режисер\", \"Режиссер\", \"Кино - Открыть режиссера\"],\n    [\"Актеры\", \"Актеры\", \"Кино - Открыть актера\"],\n    [\"Жанр\", \"Жанры\", \"Кино - Открыть жанр\"]\n];\n\nfunction kinoEntityText(value) {\n    return String(value ?? \"\").trim().normalize(\"NFC\");\n}\n\nfunction kinoEntityKey(value) {\n    return kinoEntityText(value).toLocaleLowerCase(\"ru\").replace(/ё/g, \"е\");\n}\n\nfunction kinoCanonicalGenre(value) {\n    const text = kinoEntityText(value);\n    const key = kinoEntityKey(text);\n    for (const [canonical, aliases] of Object.entries(KINO_GENRE_ALIASES)) {\n        if ([canonical, ...aliases].some(alias => kinoEntityKey(alias) === key)) return canonical;\n    }\n    return text;\n}\n\nfunction kinoValues(value) {\n    return [...new Set((Array.isArray(value) ? value : [value])\n        .map(kinoEntityText).filter(Boolean))];\n}\n\nfunction kinoCanonical(field, value) {\n    return field === \"Жанр\" ? kinoCanonicalGenre(value) : kinoEntityText(value);\n}\n\nfunction kinoUri(choice, value) {\n    return \"obsidian://quickadd?vault=\" + encodeURIComponent(app.vault.getName())\n        + \"&choice=\" + encodeURIComponent(choice)\n        + \"&value-entity=\" + encodeURIComponent(value);\n}\n\nconst kinoRoot = dv.container.createDiv({ cls: \"kino-entity-links\" });\nfor (const [field, label, choice] of KINO_ENTITY_FIELDS) {\n    const groups = new Map();\n    for (const original of kinoValues(dv.current()[field])) {\n        const canonical = kinoCanonical(field, original);\n        const key = kinoEntityKey(canonical);\n        if (!groups.has(key)) groups.set(key, { label: canonical, originals: [] });\n        groups.get(key).originals.push(original);\n    }\n    const row = kinoRoot.createDiv({ cls: \"kino-entity-links-row\" });\n    row.createEl(\"strong\", { text: label + \": \" });\n    if (!groups.size) {\n        row.appendText(\"Не указано\");\n        continue;\n    }\n    [...groups.values()].forEach((group, index) => {\n        if (index) row.appendText(\" · \");\n        const link = row.createEl(\"a\");\n        link.textContent = group.label;\n        link.href = kinoUri(choice, group.label);\n        if (group.originals.some(original => original !== group.label)) {\n            link.title = \"В YAML: \" + group.originals.join(\" / \");\n        }\n    });\n}\n```";
const KINO_PERSON_ALIASES = {"Актеры":{"angelabassett":"Angela Bassett (Анджела Бассетт)","анджелабассетт":"Angela Bassett (Анджела Бассетт)","chrisferrarini":"Chris Ferrarini (Крис Феррарини)","крисферрарини":"Chris Ferrarini (Крис Феррарини)","erniesloman":"Ernie Sloman (Эрни Сломан)","эрнисломан":"Ernie Sloman (Эрни Сломан)","caryymizobe":"Cary Y. Mizobe (Кэри И. Мидзобэ)","кэриимидзобэ":"Cary Y. Mizobe (Кэри И. Мидзобэ)","mitchyapko":"Mitch Yapko (Митч Япко)","митчяпко":"Mitch Yapko (Митч Япко)","victorjaco":"Victor Jaco (Виктор Александр Яко)","викторалександряко":"Victor Jaco (Виктор Александр Яко)","aamirkhan":"Aamir Khan (Аамир Кхан)","аамиркхан":"Aamir Khan (Аамир Кхан)","aaronpoole":"Aaron Poole (Аарон Пул)","ааронпул":"Aaron Poole (Аарон Пул)","adriangrenier":"Adrian Grenier (Эдриан Гренье)","эдриангренье":"Adrian Grenier (Эдриан Гренье)","alainchabat":"Alain Chabat (Ален Шаба)","аленшаба":"Alain Chabat (Ален Шаба)","alaindelon":"Alain Delon (Ален Делон)","аленделон":"Alain Delon (Ален Делон)","alekseydemidov":"Aleksey Demidov (Алексей Демидов)","алексеидемидов":"Aleksey Demidov (Алексей Демидов)","allegraedwards":"Allegra Edwards (Аллегра Эдвардс)","аллеграэдвардс":"Allegra Edwards (Аллегра Эдвардс)","alyssadiaz":"Alyssa Diaz (Алисса Диас)","алиссадиас":"Alyssa Diaz (Алисса Диас)","andreariseborough":"Andrea Riseborough (Андреа Райзборо)","андреараизборо":"Andrea Riseborough (Андреа Райзборо)","andrewlincoln":"Andrew Lincoln (Эндрю Линкольн)","эндрюлинкольн":"Andrew Lincoln (Эндрю Линкольн)","andrewscott":"Andrew Scott (Эндрю Скотт)","эндрюскотт":"Andrew Scott (Эндрю Скотт)","andreyskorokhod":"Andrey Skorokhod (Андрей Скороход)","андреискороход":"Andrey Skorokhod (Андрей Скороход)","andyallo":"Andy Allo (Энди Алло)","эндиалло":"Andy Allo (Энди Алло)","andylau":"Andy Lau (Энди Лау)","эндилау":"Andy Lau (Энди Лау)","anjanavasan":"Anjana Vasan (Анджана Васан)","анджанавасан":"Anjana Vasan (Анджана Васан)","annehathaway":"Anne Hathaway (Энн Хэтэуэй)","эннхэтэуэи":"Anne Hathaway (Энн Хэтэуэй)","anushkasharma":"Anushka Sharma (Анушка Шарма)","анушкашарма":"Anushka Sharma (Анушка Шарма)","arminmuellerstahl":"Armin Mueller-Stahl (Армин Мюллер-Шталь)","арминмюллершталь":"Armin Mueller-Stahl (Армин Мюллер-Шталь)","arnoldschwarzenegger":"Arnold Schwarzenegger (Арнольд Шварценеггер)","арнольдшварценеггер":"Arnold Schwarzenegger (Арнольд Шварценеггер)","austinabrams":"Austin Abrams (Остин Абрамс)","остинабрамс":"Austin Abrams (Остин Абрамс)","baedoona":"Bae Doona (Пэ Ду-на)","пэдуна":"Bae Doona (Пэ Ду-на)","бэдуна":"Bae Doona (Пэ Ду-на)","barrypepper":"Barry Pepper (Барри Пеппер)","баррипеппер":"Barry Pepper (Барри Пеппер)","benoitmagimel":"Benoît Magimel (Бенуа Мажимель)","бенуамажимель":"Benoît Magimel (Бенуа Мажимель)","billskarsgard":"Bill Skarsgård (Билл Скарсгард)","биллскарсгард":"Bill Skarsgård (Билл Скарсгард)","billyconnolly":"Billy Connolly (Билли Коннолли)","билликоннолли":"Billy Connolly (Билли Коннолли)","blakelively":"Blake Lively (Блейк Лайвли)","блеиклаивли":"Blake Lively (Блейк Лайвли)","bobgunton":"Bob Gunton (Боб Гантон)","бобгантон":"Bob Gunton (Боб Гантон)","bokeemwoodbine":"Bokeem Woodbine (Боким Вудбайн)","бокимвудбаин":"Bokeem Woodbine (Боким Вудбайн)","bradpitt":"Brad Pitt (Брэд Питт)","брэдпитт":"Brad Pitt (Брэд Питт)","брэдпит":"Brad Pitt (Брэд Питт)","bradleycooper":"Bradley Cooper (Брэдли Купер)","брэдликупер":"Bradley Cooper (Брэдли Купер)","brinnakelly":"Brinna Kelly (Бринна Келли)","бриннакелли":"Brinna Kelly (Бринна Келли)","bryancranston":"Bryan Cranston (Брайан Крэнстон)","браианкрэнстон":"Bryan Cranston (Брайан Крэнстон)","camilamendes":"Camila Mendes (Камила Мендес)","камиламендес":"Camila Mendes (Камила Мендес)","carlosmanuelvesga":"Carlos-Manuel Vesga (Карлос-Мануэль Весга)","карлосмануэльвесга":"Carlos-Manuel Vesga (Карлос-Мануэль Весга)","cateblanchett":"Cate Blanchett (Кейт Бланшетт)","кеитбланшетт":"Cate Blanchett (Кейт Бланшетт)","charliebarnett":"Charlie Barnett (Чарли Барнетт)","чарлибарнетт":"Charlie Barnett (Чарли Барнетт)","charlotteritchie":"Charlotte Ritchie (Шарлотта Ритчи)","шарлоттаритчи":"Charlotte Ritchie (Шарлотта Ритчи)","christianbale":"Christian Bale (Кристиан Бэйл)","кристианбэил":"Christian Bale (Кристиан Бэйл)","christophwaltz":"Christoph Waltz (Кристоф Вальц)","кристофвальц":"Christoph Waltz (Кристоф Вальц)","ciaranhinds":"Ciarán Hinds (Киран Хайндс)","киранхаиндс":"Ciarán Hinds (Киран Хайндс)","cliffcurtis":"Cliff Curtis (Клифф Кёртис)","клиффкертис":"Cliff Curtis (Клифф Кёртис)","cliffordbanagale":"Clifford Bañagale (Клиффорд Баньягале)","клиффордбаньягале":"Clifford Bañagale (Клиффорд Баньягале)","clinteastwood":"Clint Eastwood (Клинт Иствуд)","клинтиствуд":"Clint Eastwood (Клинт Иствуд)","colehauser":"Cole Hauser (Коул Хаузер)","коулхаузер":"Cole Hauser (Коул Хаузер)","colinfarrell":"Colin Farrell (Колин Фаррелл)","колинфаррелл":"Colin Farrell (Колин Фаррелл)","common":"Common (Коммон)","коммон":"Common (Коммон)","craigbierko":"Craig Bierko (Крэйг Бирко)","крэигбирко":"Craig Bierko (Крэйг Бирко)","cristinmilioti":"Cristin Milioti (Кристин Милиоти)","кристинмилиоти":"Cristin Milioti (Кристин Милиоти)","dafnekeen":"Dafne Keen (Дафни Кин)","дафникин":"Dafne Keen (Дафни Кин)","dakotafanning":"Dakota Fanning (Дакота Фаннинг)","дакотафаннинг":"Dakota Fanning (Дакота Фаннинг)","damsonidris":"Damson Idris (Дэмсон Идрис)","дэмсонидрис":"Damson Idris (Дэмсон Идрис)","danaigurira":"Danai Gurira (Данай Гурира)","данаигурира":"Danai Gurira (Данай Гурира)","davefranco":"Dave Franco (Дэйв Франко)","дэивфранко":"Dave Franco (Дэйв Франко)","demimoore":"Demi Moore (Деми Мур)","демимур":"Demi Moore (Деми Мур)","dennisquaid":"Dennis Quaid (Деннис Куэйд)","деннискуэид":"Dennis Quaid (Деннис Куэйд)","denzelwashington":"Denzel Washington (Дензел Вашингтон)","дензелвашингтон":"Denzel Washington (Дензел Вашингтон)","dolphlundgren":"Dolph Lundgren (Дольф Лундгрен)","дольфлундгрен":"Dolph Lundgren (Дольф Лундгрен)","donnieyen":"Donnie Yen (Донни Йен)","доннииен":"Donnie Yen (Донни Йен)","dougrayscott":"Dougray Scott (Дугрей Скотт)","дугреискотт":"Dougray Scott (Дугрей Скотт)","eddieredmayne":"Eddie Redmayne (Эдди Редмэйн)","эддиредмэин":"Eddie Redmayne (Эдди Редмэйн)","eizagonzalez":"Eiza González (Эйса Гонсалес)","эисагонсалес":"Eiza González (Эйса Гонсалес)","eleanormatsuura":"Eleanor Matsuura (Элинор Мацуура)","элинормацуура":"Eleanor Matsuura (Элинор Мацуура)","elliotpage":"Elliot Page (Эллиот Пейдж)","эллиотпеидж":"Elliot Page (Эллиот Пейдж)","erickeenleyside":"Eric Keenleyside (Эрик Кинсайд)","эриккинсаид":"Eric Keenleyside (Эрик Кинсайд)","ethanhawke":"Ethan Hawke (Итан Хоук)","итанхоук":"Ethan Hawke (Итан Хоук)","evgeniytsyganov":"Evgeniy Tsyganov (Евгений Цыганов)","евгениицыганов":"Evgeniy Tsyganov (Евгений Цыганов)","florencepugh":"Florence Pugh (Флоренс Пью)","флоренспью":"Florence Pugh (Флоренс Пью)","frankdillane":"Frank Dillane (Фрэнк Диллэйн)","фрэнкдиллэин":"Frank Dillane (Фрэнк Диллэйн)","gabrielleone":"Gabriel Leone (Габриэл Леоне)","габриэллеоне":"Gabriel Leone (Габриэл Леоне)","garyoldman":"Gary Oldman (Гэри Олдман)","гэриолдман":"Gary Oldman (Гэри Олдман)","гариолдман":"Gary Oldman (Гэри Олдман)","genarowlands":"Gena Rowlands (Джина Роулендс)","джинароулендс":"Gena Rowlands (Джина Роулендс)","georgeclooney":"George Clooney (Джордж Клуни)","джорджклуни":"George Clooney (Джордж Клуни)","geraintwyndavies":"Geraint Wyn Davies (Джерент Уин Дэйвис)","джерентуиндэивис":"Geraint Wyn Davies (Джерент Уин Дэйвис)","gerardbutler":"Gerard Butler (Джерард Батлер)","джерардбатлер":"Gerard Butler (Джерард Батлер)","ginoanthonypesi":"Gino Anthony Pesi (Джино Энтони Пези)","джиноэнтонипези":"Gino Anthony Pesi (Джино Энтони Пези)","gretalee":"Greta Lee (Грета Ли)","гретали":"Greta Lee (Грета Ли)","gretchenmol":"Gretchen Mol (Гретхен Мол)","гретхенмол":"Gretchen Mol (Гретхен Мол)","gustafhammarsten":"Gustaf Hammarsten (Густаф Хаммарстен)","густафхаммарстен":"Gustaf Hammarsten (Густаф Хаммарстен)","gwynethpaltrow":"Gwyneth Paltrow (Гвинет Пэлтроу)","гвинетпэлтроу":"Gwyneth Paltrow (Гвинет Пэлтроу)","halleberry":"Halle Berry (Холли Берри)","холлиберри":"Halle Berry (Холли Берри)","harrisonford":"Harrison Ford (Харрисон Форд)","харрисонфорд":"Harrison Ford (Харрисон Форд)","heweiyu":"Hewei Yu (Юй Хэвэй)","юихэвэи":"Hewei Yu (Юй Хэвэй)","ianhart":"Ian Hart (Иэн Харт)","иэнхарт":"Ian Hart (Иэн Харт)","idriselba":"Idris Elba (Идрис Эльба)","идрисэльба":"Idris Elba (Идрис Эльба)","ikouwais":"Iko Uwais (Ико Ювайс)","икоюваис":"Iko Uwais (Ико Ювайс)","jksimmons":"J.K. Simmons (Дж.К. Симмонс)","джксиммонс":"J.K. Simmons (Дж.К. Симмонс)","jacindabarrett":"Jacinda Barrett (Джасинда Барретт)","джасиндабарретт":"Jacinda Barrett (Джасинда Барретт)","jackalcott":"Jack Alcott (Джек Элкотт)","джекэлкотт":"Jack Alcott (Джек Элкотт)","jamesgarner":"James Garner (Джеймс Гарнер)","джеимсгарнер":"James Garner (Джеймс Гарнер)","jamesmarsden":"James Marsden (Джеймс Марсден)","джеимсмарсден":"James Marsden (Джеймс Марсден)","jamesortiz":"James Ortiz (Джеймс Ортис)","джеимсортис":"James Ortiz (Джеймс Ортис)","jamieclayton":"Jamie Clayton (Джейми Клейтон)","джеимиклеитон":"Jamie Clayton (Джейми Клейтон)","jaredpadalecki":"Jared Padalecki (Джаред Падалеки)","джаредпадалеки":"Jared Padalecki (Джаред Падалеки)","jasonstuart":"Jason Stuart (Джейсон Стюарт)","джеисонстюарт":"Jason Stuart (Джейсон Стюарт)","javierbardem":"Javier Bardem (Хавьер Бардем)","хавьербардем":"Javier Bardem (Хавьер Бардем)","jazsinclair":"Jaz Sinclair (Джаз Синклер)","джазсинклер":"Jaz Sinclair (Джаз Синклер)","jeffreydeanmorgan":"Jeffrey Dean Morgan (Джеффри Дин Морган)","джеффридинморган":"Jeffrey Dean Morgan (Джеффри Дин Морган)","jennifergarner":"Jennifer Garner (Дженнифер Гарнер)","дженнифергарнер":"Jennifer Garner (Дженнифер Гарнер)","jensenackles":"Jensen Ackles (Дженсен Эклз)","дженсенэклз":"Jensen Ackles (Дженсен Эклз)","jesseeisenberg":"Jesse Eisenberg (Джесси Айзенберг)","джессиаизенберг":"Jesse Eisenberg (Джесси Айзенберг)","jimbeaver":"Jim Beaver (Джим Бивер)","джимбивер":"Jim Beaver (Джим Бивер)","jimcarrey":"Jim Carrey (Джим Керри)","джимкерри":"Jim Carrey (Джим Керри)","jinseonkyu":"Jin Seon-kyu (Чин Сон-гю)","чинсонгю":"Jin Seon-kyu (Чин Сон-гю)","jingwu":"Jing Wu (У Цзин)","уцзин":"Jing Wu (У Цзин)","johncena":"John Cena (Джон Сина)","джонсина":"John Cena (Джон Сина)","johnkrasinski":"John Krasinski (Джон Красински)","джонкрасински":"John Krasinski (Джон Красински)","johnmalkovich":"John Malkovich (Джон Малкович)","джонмалкович":"John Malkovich (Джон Малкович)","johnnyflynn":"Johnny Flynn (Джонни Флинн)","джоннифлинн":"Johnny Flynn (Джонни Флинн)","joshlucas":"Josh Lucas (Джош Лукас)","джошлукас":"Josh Lucas (Джош Лукас)","jovanadepo":"Jovan Adepo (Джован Адепо)","джованадепо":"Jovan Adepo (Джован Адепо)","judelaw":"Jude Law (Джуд Лоу)","джудлоу":"Jude Law (Джуд Лоу)","julialouisdreyfus":"Julia Louis-Dreyfus (Джулия Луис-Дрейфус)","джулиялуисдреифус":"Julia Louis-Dreyfus (Джулия Луис-Дрейфус)","juliaroberts":"Julia Roberts (Джулия Робертс)","джулияробертс":"Julia Roberts (Джулия Робертс)","justintheroux":"Justin Theroux (Джастин Теру)","джастинтеру":"Justin Theroux (Джастин Теру)","karolinawydra":"Karolina Wydra (Каролина Выдра)","каролинавыдра":"Karolina Wydra (Каролина Выдра)","karolineeichhorn":"Karoline Eichhorn (Каролине Айххорн)","каролинеаиххорн":"Karoline Eichhorn (Каролине Айххорн)","kayascodelario":"Kaya Scodelario (Кая Скоделарио)","каяскоделарио":"Kaya Scodelario (Кая Скоделарио)","kenwatanabe":"Ken Watanabe (Кэн Ватанабэ)","кэнватанабэ":"Ken Watanabe (Кэн Ватанабэ)","kentoyamazaki":"Kento Yamazaki (Кэнто Ямазаки)","кэнтоямазаки":"Kento Yamazaki (Кэнто Ямазаки)","kellyreilly":"Kelly Reilly (Келли Райлли)","келлираилли":"Kelly Reilly (Келли Райлли)","kimbyeongcheol":"Kim Byeong-cheol (Ким Бён-чхоль)","кимбенчхоль":"Kim Byeong-cheol (Ким Бён-чхоль)","kimdickens":"Kim Dickens (Ким Диккенс)","кимдиккенс":"Kim Dickens (Ким Диккенс)","kimhyejun":"Kim Hye-jun (Ким Хе-джун)","кимхеджун":"Kim Hye-jun (Ким Хе-джун)","kimtaeri":"Kim Tae-ri (Ким Тхэ-ри)","кимтхэри":"Kim Tae-ri (Ким Тхэ-ри)","kitconnor":"Kit Connor (Кит Коннор)","китконнор":"Kit Connor (Кит Коннор)","kitharington":"Kit Harington (Кит Харингтон)","китхарингтон":"Kit Harington (Кит Харингтон)","kurtrussell":"Kurt Russell (Курт Рассел)","куртрассел":"Kurt Russell (Курт Рассел)","lashanalynch":"Lashana Lynch (Лашана Линч)","лашаналинч":"Lashana Lynch (Лашана Линч)","laurencohan":"Lauren Cohan (Лорен Коэн)","лоренкоэн":"Lauren Cohan (Лорен Коэн)","laurencefishburne":"Laurence Fishburne (Лоренс Фишбёрн)","лоренсфишберн":"Laurence Fishburne (Лоренс Фишбёрн)","leejaewook":"Lee Jae-wook (Ли Джэ-ук)","лиджэук":"Lee Jae-wook (Ли Джэ-ук)","leejunho":"Lee Jun-ho (Ли Джун-хо)","лиджунхо":"Lee Jun-ho (Ли Джун-хо)","lenaheadey":"Lena Headey (Лена Хиди)","ленахиди":"Lena Headey (Лена Хиди)","lesliebibb":"Leslie Bibb (Лесли Бибб)","леслибибб":"Leslie Bibb (Лесли Бибб)","lesliemann":"Leslie Mann (Лесли Манн)","леслиманн":"Leslie Mann (Лесли Манн)","liamcunningham":"Liam Cunningham (Лиам Каннингэм)","лиамканнингэм":"Liam Cunningham (Лиам Каннингэм)","liamhemsworth":"Liam Hemsworth (Лиам Хемсворт)","лиамхемсворт":"Liam Hemsworth (Лиам Хемсворт)","lindacardellini":"Linda Cardellini (Линда Карделлини)","линдакарделлини":"Linda Cardellini (Линда Карделлини)","lisavicari":"Lisa Vicari (Лиза Викари)","лизавикари":"Lisa Vicari (Лиза Викари)","lizzebroadway":"Lizze Broadway (Лиззи Бродвей)","лиззибродвеи":"Lizze Broadway (Лиззи Бродвей)","louishofmann":"Louis Hofmann (Луис Хофманн)","луисхофманн":"Louis Hofmann (Луис Хофманн)","luyizhang":"Luyi Zhang (Чжан Луйи)","чжанлуии":"Luyi Zhang (Чжан Луйи)","leadrucker":"Léa Drucker (Леа Дрюкер)","леадрюкер":"Léa Drucker (Леа Дрюкер)","maddiephillips":"Maddie Phillips (Мэдди Филлипс)","мэддифиллипс":"Maddie Phillips (Мэдди Филлипс)","madhavan":"Madhavan (Мадхаван)","мадхаван":"Madhavan (Мадхаван)","mahershalaali":"Mahershala Ali (Махершала Али)","махершалаали":"Mahershala Ali (Махершала Али)","mahinanapoleon":"Mahina Napoleon (Махина Наполеон)","махинанаполеон":"Mahina Napoleon (Махина Наполеон)","malikzidi":"Malik Zidi (Малик Зиди)","маликзиди":"Malik Zidi (Малик Зиди)","mantatng":"Man-Tat Ng (Нг Мань-Тат)","нгманьтат":"Man-Tat Ng (Нг Мань-Тат)","margaretqualley":"Margaret Qualley (Маргарет Куэлли)","маргареткуэлли":"Margaret Qualley (Маргарет Куэлли)","marielaforet":"Marie Laforêt (Мари Лафоре)","марилафоре":"Marie Laforêt (Мари Лафоре)","markruffalo":"Mark Ruffalo (Марк Руффало)","маркруффало":"Mark Ruffalo (Марк Руффало)","markwahlberg":"Mark Wahlberg (Марк Уолберг)","маркуолберг":"Mark Wahlberg (Марк Уолберг)","mathieuamalric":"Mathieu Amalric (Матьё Амальрик)","матьеамальрик":"Mathieu Amalric (Матьё Амальрик)","mattdamon":"Matt Damon (Мэтт Дэймон)","мэттдэимон":"Matt Damon (Мэтт Дэймон)","mattmella":"Matt Mella (Мэтт Мелла)","мэттмелла":"Matt Mella (Мэтт Мелла)","matthewbroderick":"Matthew Broderick (Мэттью Бродерик)","мэттьюбродерик":"Matthew Broderick (Мэттью Бродерик)","mauriceronet":"Maurice Ronet (Морис Роне)","морисроне":"Maurice Ronet (Морис Роне)","mauriciohenao":"Mauricio Hénao (Маурисио Энао)","маурисиоэнао":"Mauricio Hénao (Маурисио Энао)","mayahawke":"Maya Hawke (Майя Хоук)","маияхоук":"Maya Hawke (Майя Хоук)","melgibson":"Mel Gibson (Мэл Гибсон)","мэлгибсон":"Mel Gibson (Мэл Гибсон)","melissamcbride":"Melissa McBride (Мелисса Макбрайд)","мелиссамакбраид":"Melissa McBride (Мелисса Макбрайд)","merylstreep":"Meryl Streep (Мэрил Стрип)","мэрилстрип":"Meryl Streep (Мэрил Стрип)","michaelchall":"Michael C. Hall (Майкл Си Холл)","маиклсихолл":"Michael C. Hall (Майкл Си Холл)","michaelcera":"Michael Cera (Майкл Сера)","маиклсера":"Michael Cera (Майкл Сера)","michaelironside":"Michael Ironside (Майкл Айронсайд)","маиклаиронсаид":"Michael Ironside (Майкл Айронсайд)","michelledockery":"Michelle Dockery (Мишель Докери)","мишельдокери":"Michelle Dockery (Мишель Докери)","michellemonaghan":"Michelle Monaghan (Мишель Монахэн)","мишельмонахэн":"Michelle Monaghan (Мишель Монахэн)","michielhuisman":"Michiel Huisman (Михил Хёйсман)","михилхеисман":"Michiel Huisman (Михил Хёйсман)","mikhailevlanov":"Mikhail Evlanov (Михаил Евланов)","михаилевланов":"Mikhail Evlanov (Михаил Евланов)","milakunis":"Mila Kunis (Мила Кунис)","милакунис":"Mila Kunis (Мила Кунис)","monasingh":"Mona Singh (Мона Сингх)","монасингх":"Mona Singh (Мона Сингх)","morenabaccarin":"Morena Baccarin (Морена Баккарин)","моренабаккарин":"Morena Baccarin (Морена Баккарин)","morganfreeman":"Morgan Freeman (Морган Фриман)","морганфриман":"Morgan Freeman (Морган Фриман)","melanielaurent":"Mélanie Laurent (Мелани Лоран)","меланилоран":"Mélanie Laurent (Мелани Лоран)","natalieportman":"Natalie Portman (Натали Портман)","наталипортман":"Natalie Portman (Натали Портман)","natashalyonne":"Natasha Lyonne (Наташа Лионн)","наташалионн":"Natasha Lyonne (Наташа Лионн)","nathanfillion":"Nathan Fillion (Нэйтан Филлион)","нэитанфиллион":"Nathan Fillion (Нэйтан Филлион)","nicolascage":"Nicolas Cage (Николас Кейдж)","николаскеидж":"Nicolas Cage (Николас Кейдж)","nijiromurakami":"Nijirô Murakami (Нидзиро Мураками)","нидзиромураками":"Nijirô Murakami (Нидзиро Мураками)","normanreedus":"Norman Reedus (Норман Ридус)","норманридус":"Norman Reedus (Норман Ридус)","olegvasilkov":"Oleg Vasilkov (Олег Васильков)","олегвасильков":"Oleg Vasilkov (Олег Васильков)","owenwilson":"Owen Wilson (Оуэн Уилсон)","оуэнуилсон":"Owen Wilson (Оуэн Уилсон)","paapaessiedu":"Paapa Essiedu (Паапа Эссьеду)","паапаэссьеду":"Paapa Essiedu (Паапа Эссьеду)","parksodam":"Park So-dam (Пак Со-дам)","паксодам":"Park So-dam (Пак Со-дам)","pelageyanevzorova":"Pelageya Nevzorova (Пелагея Невзорова)","пелагеяневзорова":"Pelageya Nevzorova (Пелагея Невзорова)","pennbadgley":"Penn Badgley (Пенн Бэджли)","пеннбэджли":"Penn Badgley (Пенн Бэджли)","philipkeung":"Philip Keung (Филип Кёнг)","филипкенг":"Philip Keung (Филип Кёнг)","pollyannamcintosh":"Pollyanna McIntosh (Поллианна Макинтош)","поллианнамакинтош":"Pollyanna McIntosh (Поллианна Макинтош)","priyankachoprajonas":"Priyanka Chopra Jonas (Приянка Чопра Джонас)","приянкачопраджонас":"Priyanka Chopra Jonas (Приянка Чопра Джонас)","rachelmcadams":"Rachel McAdams (Рэйчел Макадамс)","рэичелмакадамс":"Rachel McAdams (Рэйчел Макадамс)","rheaseehorn":"Rhea Seehorn (Рея Сихорн)","реясихорн":"Rhea Seehorn (Рея Сихорн)","richardtjones":"Richard T. Jones (Ричард Т. Джонс)","ричардтджонс":"Richard T. Jones (Ричард Т. Джонс)","robbieamell":"Robbie Amell (Робби Амелл)","роббиамелл":"Robbie Amell (Робби Амелл)","robindunne":"Robin Dunne (Робин Данн)","робинданн":"Robin Dunne (Робин Данн)","rogerdalefloyd":"Roger Dale Floyd (Роджер Дейл Флойд)","роджердеилфлоид":"Roger Dale Floyd (Роджер Дейл Флойд)","romainlevi":"Romain Levi (Ромен Леви)","роменлеви":"Romain Levi (Ромен Леви)","romangriffindavis":"Roman Griffin Davis (Роман Гриффин Дэвис)","романгриффиндэвис":"Roman Griffin Davis (Роман Гриффин Дэвис)","ruthwilson":"Ruth Wilson (Рут Уилсон)","рутуилсон":"Ruth Wilson (Рут Уилсон)","ryangosling":"Ryan Gosling (Райан Гослинг)","раиангослинг":"Ryan Gosling (Райан Гослинг)","sachabaroncohen":"Sacha Baron Cohen (Саша Барон Коэн)","сашабаронкоэн":"Sacha Baron Cohen (Саша Барон Коэн)","samworthington":"Sam Worthington (Сэм Уортингтон)","сэмуортингтон":"Sam Worthington (Сэм Уортингтон)","sandrabullock":"Sandra Bullock (Сандра Буллок)","сандрабуллок":"Sandra Bullock (Сандра Буллок)","sandrahuller":"Sandra Hüller (Сандра Хюллер)","сандрахюллер":"Sandra Hüller (Сандра Хюллер)","sanjaydutt":"Sanjay Dutt (Санджай Датт)","санджаидатт":"Sanjay Dutt (Санджай Датт)","scottglenn":"Scott Glenn (Скотт Гленн)","скоттгленн":"Scott Glenn (Скотт Гленн)","sebastianstan":"Sebastian Stan (Себастиан Стэн)","себастианстэн":"Sebastian Stan (Себастиан Стэн)","seoinguk":"Seo In-guk (Со Ин-гук)","соингук":"Seo In-guk (Со Ин-гук)","sharonstone":"Sharon Stone (Шэрон Стоун)","шэронстоун":"Sharon Stone (Шэрон Стоун)","sigourneyweaver":"Sigourney Weaver (Сигурни Уивер)","сигурниуивер":"Sigourney Weaver (Сигурни Уивер)","songjoongki":"Song Joong-ki (Сон Джун-ги)","сонджунги":"Song Joong-ki (Сон Джун-ги)","sophiadimartino":"Sophia Di Martino (София Ди Мартино)","софиядимартино":"Sophia Di Martino (София Ди Мартино)","steveaustin":"Steve Austin (Стив Остин)","стивостин":"Steve Austin (Стив Остин)","taotsuchiya":"Tao Tsuchiya (Тао Цутия)","таоцутия":"Tao Tsuchiya (Тао Цутия)","taylourpaige":"Taylour Paige (Тейлор Пейдж)","теилорпеидж":"Taylour Paige (Тейлор Пейдж)","timrobbins":"Tim Robbins (Тим Роббинс)","тимроббинс":"Tim Robbins (Тим Роббинс)","tinadesai":"Tina Desai (Тина Десай)","тинадесаи":"Tina Desai (Тина Десай)","tomcruise":"Tom Cruise (Том Круз)","томкруз":"Tom Cruise (Том Круз)","tomhiddleston":"Tom Hiddleston (Том Хиддлстон)","томхиддлстон":"Tom Hiddleston (Том Хиддлстон)","tophergrace":"Topher Grace (Тофер Грейс)","тофергреис":"Topher Grace (Тофер Грейс)","umathurman":"Uma Thurman (Ума Турман)","уматурман":"Uma Thurman (Ума Турман)","valeriyafedorovich":"Valeriya Fedorovich (Валерия Федорович)","валерияфедорович":"Valeriya Fedorovich (Валерия Федорович)","victoriapedretti":"Victoria Pedretti (Виктория Педретти)","викторияпедретти":"Victoria Pedretti (Виктория Педретти)","viggomortensen":"Viggo Mortensen (Вигго Мортенсен)","виггомортенсен":"Viggo Mortensen (Вигго Мортенсен)","williamshatner":"William Shatner (Уильям Шэтнер)","уильямшэтнер":"William Shatner (Уильям Шэтнер)","woodyharrelson":"Woody Harrelson (Вуди Харрельсон)","вудихаррельсон":"Woody Harrelson (Вуди Харрельсон)","yanmanzizhu":"Yanmanzi Zhu (Чжу Яньманьцзы)","чжуяньманьцзы":"Yanmanzi Zhu (Чжу Яньманьцзы)","yahyaabdulmateenii":"Yahya Abdul-Mateen II (Яхья Абдул-Матин II)","яхьяабдулматинii":"Yahya Abdul-Mateen II (Яхья Абдул-Матин II)","yisha":"Yi Sha (И Ша)","иша":"Yi Sha (И Ша)","yongjianlin":"Yongjian Lin (Линь Юнцзянь)","линьюнцзянь":"Yongjian Lin (Линь Юнцзянь)","yuliyaperesild":"Yuliya Peresild (Юлия Пересильд)","юлияпересильд":"Yuliya Peresild (Юлия Пересильд)","zhannaepple":"Zhanna Epple (Жанна Эппле)","жаннаэппле":"Zhanna Epple (Жанна Эппле)","zhiwang":"Zhi Wang (Ван Чжи)","ванчжи":"Zhi Wang (Ван Чжи)","zoesaldana":"Zoe Saldaña (Зои Салдана)","зоисалдана":"Zoe Saldaña (Зои Салдана)"},"Режисер":{"brettscottermilio":"Brett Scott Ermilio (Бретт Скотт Эрмилио)","бреттскоттэрмилио":"Brett Scott Ermilio (Бретт Скотт Эрмилио)","alexandreaja":"Alexandre Aja (Александр Ажа)","александража":"Alexandre Aja (Александр Ажа)","amanchang":"Aman Chang (Аман Чан)","аманчан":"Aman Chang (Аман Чан)","чанминь":"Aman Chang (Аман Чан)","anthonyminghella":"Anthony Minghella (Энтони Мингелла)","энтонимингелла":"Anthony Minghella (Энтони Мингелла)","antoinefuqua":"Antoine Fuqua (Антуан Фукуа)","антуанфукуа":"Antoine Fuqua (Антуан Фукуа)","benstiller":"Ben Stiller (Бен Стиллер)","бенстиллер":"Ben Stiller (Бен Стиллер)","bobgale":"Bob Gale (Боб Гейл)","бобгеил":"Bob Gale (Боб Гейл)","christophermiller":"Christopher Miller (Кристофер Миллер)","кристофермиллер":"Christopher Miller (Кристофер Миллер)","clinteastwood":"Clint Eastwood (Клинт Иствуд)","клинтиствуд":"Clint Eastwood (Клинт Иствуд)","coraliefargeat":"Coralie Fargeat (Корали Фаржа)","коралифаржа":"Coralie Fargeat (Корали Фаржа)","dchamilton":"D.C. Hamilton (Д. С. Хэмилтон)","дсхэмилтон":"D.C. Hamilton (Д. С. Хэмилтон)","davidfrankel":"David Frankel (Дэвид Фрэнкел)","дэвидфрэнкел":"David Frankel (Дэвид Фрэнкел)","edwardzwick":"Edward Zwick (Эдвард Цвик)","эдвардцвик":"Edward Zwick (Эдвард Цвик)","frankdarabont":"Frank Darabont (Фрэнк Дарабонт)","фрэнкдарабонт":"Frank Darabont (Фрэнк Дарабонт)","frantgwo":"Frant Gwo (Го Фань)","гофань":"Frant Gwo (Го Фань)","garyross":"Gary Ross (Гэри Росс)","гэриросс":"Gary Ross (Гэри Росс)","guyritchie":"Guy Ritchie (Гай Ричи)","гаиричи":"Guy Ritchie (Гай Ричи)","ilyanaishuller":"Ilya Naishuller (Илья Найшуллер)","ильянаишуллер":"Ilya Naishuller (Илья Найшуллер)","jakeschreier":"Jake Schreier (Джейк Шрейер)","джеикшреиер":"Jake Schreier (Джейк Шрейер)","jamescameron":"James Cameron (Джеймс Кэмерон)","джеимскэмерон":"James Cameron (Джеймс Кэмерон)","jasoncabell":"Jason Cabell (Джейсон Кабелл)","джеисонкабелл":"Jason Cabell (Джейсон Кабелл)","jasonkwan":"Jason Kwan (Джейсон Кван)","джеисонкван":"Jason Kwan (Джейсон Кван)","jasonreitman":"Jason Reitman (Джейсон Райтман)","джеисонраитман":"Jason Reitman (Джейсон Райтман)","jenniferkaytinrobinson":"Jennifer Kaytin Robinson (Дженнифер Кейтин Робинсон)","дженниферкеитинробинсон":"Jennifer Kaytin Robinson (Дженнифер Кейтин Робинсон)","jessevjohnson":"Jesse V. Johnson (Джесси Джонсон)","джессиджонсон":"Jesse V. Johnson (Джесси Джонсон)","jingwong":"Jing Wong (Вонг Цзин)","вонгцзин":"Jing Wong (Вонг Цзин)","вонгджин":"Jing Wong (Вонг Цзин)","jonmchu":"Jon M. Chu (Джон М. Чу)","джонмчу":"Jon M. Chu (Джон М. Чу)","josefrusnak":"Josef Rusnak (Йозеф Руснак)","иозефруснак":"Josef Rusnak (Йозеф Руснак)","josephkosinski":"Joseph Kosinski (Джозеф Косински)","джозефкосински":"Joseph Kosinski (Джозеф Косински)","julianfarino":"Julian Farino (Джулиан Фарино)","джулианфарино":"Julian Farino (Джулиан Фарино)","larrycharles":"Larry Charles (Ларри Чарльз)","ларричарльз":"Larry Charles (Ларри Чарльз)","leetolandkrieger":"Lee Toland Krieger (Ли Толанд Кригер)","литоландкригер":"Lee Toland Krieger (Ли Толанд Кригер)","lenwiseman":"Len Wiseman (Лен Уайзман)","ленуаизман":"Len Wiseman (Лен Уайзман)","lilianacavani":"Liliana Cavani (Лилиана Кавани)","лилианакавани":"Liliana Cavani (Лилиана Кавани)","louisleterrier":"Louis Leterrier (Луи Летерье)","луилетерье":"Louis Leterrier (Луи Летерье)","markneveldine":"Mark Neveldine (Марк Невелдайн)","маркневелдаин":"Mark Neveldine (Марк Невелдайн)","maryharron":"Mary Harron (Мэри Хэррон)","мэрихэррон":"Mary Harron (Мэри Хэррон)","melgibson":"Mel Gibson (Мэл Гибсон)","мэлгибсон":"Mel Gibson (Мэл Гибсон)","morganjfreeman":"Morgan J. Freeman (Морган Дж. Фриман)","морганджфриман":"Morgan J. Freeman (Морган Дж. Фриман)","nickcassavetes":"Nick Cassavetes (Ник Кассаветис)","никкассаветис":"Nick Cassavetes (Ник Кассаветис)","paulverhoeven":"Paul Verhoeven (Пол Верховен)","полверховен":"Paul Verhoeven (Пол Верховен)","peterberg":"Peter Berg (Питер Берг)","питерберг":"Peter Berg (Питер Берг)","peterfarrelly":"Peter Farrelly (Питер Фаррелли)","питерфаррелли":"Peter Farrelly (Питер Фаррелли)","phillord":"Phil Lord (Фил Лорд)","филлорд":"Phil Lord (Фил Лорд)","quentindupieux":"Quentin Dupieux (Квентин Дюпье)","квентиндюпье":"Quentin Dupieux (Квентин Дюпье)","rajkumarhirani":"Rajkumar Hirani (Раджкумар Хирани)","раджкумархирани":"Rajkumar Hirani (Раджкумар Хирани)","reneclement":"René Clément (Рене Клеман)","ренеклеман":"René Clément (Рене Клеман)","ricromanwaugh":"Ric Roman Waugh (Рик Роман Во)","рикроманво":"Ric Roman Waugh (Рик Роман Во)","rogerspottiswoode":"Roger Spottiswoode (Роджер Споттисвуд)","роджерспоттисвуд":"Roger Spottiswoode (Роджер Споттисвуд)","rubenfleischer":"Ruben Fleischer (Рубен Фляйшер)","рубенфляишер":"Ruben Fleischer (Рубен Фляйшер)","sergeymokritskiy":"Sergey Mokritskiy (Сергей Мокрицкий)","сергеимокрицкии":"Sergey Mokritskiy (Сергей Мокрицкий)","simoncellanjones":"Simon Cellan Jones (Саймон Селлан Джонс)","саимонселланджонс":"Simon Cellan Jones (Саймон Селлан Джонс)","stevensoderbergh":"Steven Soderbergh (Стивен Содерберг)","стивенсодерберг":"Steven Soderbergh (Стивен Содерберг)","sungheejo":"Sung-hee Jo (Чо Сон-хи)","чосонхи":"Sung-hee Jo (Чо Сон-хи)"}};
const KINO_PERSON_CANONICAL_OVERRIDES = {
    Актеры: {
        vitaliygogunskiy: "Vitaly Gogunsky (Виталий Гогунский)",
        vitalygogunsky: "Vitaly Gogunsky (Виталий Гогунский)",
        виталийгогунский: "Vitaly Gogunsky (Виталий Гогунский)",
        виталиигогунскии: "Vitaly Gogunsky (Виталий Гогунский)",
        evgeniyromantsov: "Evgeniy Romantsov (Евгений Романцов)",
        евгенийроманцов: "Evgeniy Romantsov (Евгений Романцов)"
    },
    Режисер: {
        mikhailshulaev: "Mikhail Shulaev (Михаил Шулаев)",
        михаилшулаев: "Mikhail Shulaev (Михаил Шулаев)"
    }
};
function kinoPersonBaseKey(value) {
    let text = String(value ?? "").trim().normalize("NFC");
    text = text.replace(/^\[\[([\s\S]+?)\]\]$/, "$1");
    text = text.replace(/\s*\([^()]*\)\s*$/, "");
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
}
function normalizeKinoPersonDisplay(value) {
    let text = String(value ?? "").trim().normalize("NFC");
    for (let i = 0; i < 5; i++) {
        const match = text.match(/^(.+?)\s*\((.*)\)$/);
        if (!match || !match[2].includes("(")) break;
        const inner = match[2].replace(/^.*\(([^()]*)\)$/, "$1").trim();
        if (!inner || inner === match[2]) break;
        text = `${match[1].trim()} (${inner})`;
    }
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    if (pair && kinoPersonBaseKey(pair[1]) === kinoPersonBaseKey(pair[2])) return pair[1].trim();
    return text;
}
function kinoPersonKey(value) {
    return kinoPersonBaseKey(normalizeKinoPersonDisplay(value));
}
function kinoPersonDisplay(field, value) {
    const text = String(value ?? "").trim().normalize("NFC");
    if (!text) return "";
    const key = kinoPersonKey(text);
    const canonical = KINO_PERSON_CANONICAL_OVERRIDES[field]?.[key]
        || KINO_PERSON_ALIASES[field]?.[key] || text;
    const normalized = normalizeKinoPersonDisplay(canonical);
    if (!normalized || normalized.toUpperCase() === "N/A") return normalized;
    if (/[а-яё]/i.test(normalized) && !/[a-z]/i.test(normalized)) {
        const map = { а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo", ж:"zh", з:"z", и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f", х:"kh", ц:"ts", ч:"ch", ш:"sh", щ:"shch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya" };
        const english = normalized.toLocaleLowerCase("ru").split("").map(char => map[char] ?? char).join("")
            .replace(/(^|[\s.-])([a-z])/gi, (_, separator, letter) => separator + letter.toUpperCase());
        return `${english} (${normalized})`;
    }
    return normalized;
}
const ENTITY_FIELDS = ['Режисер','Актеры','Жанр'];
function entityName(value) {
    if (value == null) return "";
    const text = String(value).trim();
    const link = text.match(/^\[\[([\s\S]+?)\]\]$/);
    if (!link) return text.normalize("NFC");
    if (link[1] === "N/A") return "N/A";
    const parts = link[1].split("|");
    return (parts.length > 1 ? parts.slice(1).join("|") : parts[0].split("#")[0]
        .replace(/\.md$/i, "").split("/").pop()).trim().normalize("NFC");
}
function normalizeEntityField(value, field) {
    if (value == null) return value;
    const source = Array.isArray(value) ? value : [value];
    const result = [...new Set(source.map(entityName).map(text =>
        field === "Режисер" || field === "Актеры" ? kinoPersonDisplay(field, text) : text
    ).filter(Boolean))];
    return Array.isArray(value) ? result : (result[0] || "");
}
function yamlParts(raw) {
    const m=raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    return m?{prefix:m[1],yaml:m[2],end:m[3],body:raw.slice(m[0].length)}:null;
}
function propertyBlock(yaml,key) {
    const exp=new RegExp('^(?:'+key+'|"'+key+'"|\''+key+'\'):[^\\r\\n]*(?:\\r?\\n(?![^ \\t\\r\\n#][^\\r\\n]*:)[^\\r\\n]*)*','m');
    return yaml.match(exp);
}
function migrateEntities(raw,ob) {
    const parts=yamlParts(raw);
    if(!parts)return raw;
    let yaml=parts.yaml;
    const newline=raw.includes('\r\n')?'\r\n':'\n';
    for(const key of ENTITY_FIELDS) {
        const block=propertyBlock(yaml,key);
        if(!block)continue;
        const value=ob.parseYaml(block[0])?.[key];
        const result=normalizeEntityField(value,key);
        if(JSON.stringify(value)===JSON.stringify(result))continue;
        const replacement=Array.isArray(result)?key+':'+(result.length?newline+result.map(x=>'  - '+JSON.stringify(x)).join(newline):' []'):key+': '+JSON.stringify(result);
        yaml=yaml.slice(0,block.index)+replacement+yaml.slice(block.index+block[0].length);
    }
    return parts.prefix+yaml+parts.end+parts.body;
}
function originalMediaPath(path) {
    return path.startsWith('Кино/') && path.endsWith('.md') && !/^Кино\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\//.test(path);
}
function isMediaRaw(path,raw,ob) {
    if(!originalMediaPath(path))return false;
    const parts=yamlParts(raw);
    if(!parts)return false;
    const block=propertyBlock(parts.yaml,'tags');
    const tags=block?ob.parseYaml(block[0])?.tags:[];
    return (Array.isArray(tags)?tags:[tags]).some(x=>['movies','serial'].includes(String(x).replace(/^#/,'')));
}
async function makeFolders(app,path) {
    let current='';
    for(const part of path.split('/').slice(0,-1)) {
        current=current?current+'/'+part:part;
        if(!app.vault.getAbstractFileByPath(current))await app.vault.createFolder(current);
    }
}

let migrationRunning=false;
module.exports=async function installEntities({app,obsidian:ob,quickAddApi:qa}) {
    if(migrationRunning)return;
    migrationRunning=true;
    const note=new ob.Notice('Подготовка миграции трех полей…',0);
    try {
        const quickadd=app.plugins.plugins.quickadd;
        if(!Array.isArray(quickadd?.settings?.choices)||typeof quickadd.saveSettings!=='function')throw new Error('QuickAdd не готов к установке команд');
        const edits=[];
        let total=0;
        for(const file of app.vault.getMarkdownFiles()) {
            if(!originalMediaPath(file.path))continue;
            const before=await app.vault.read(file);
            if(!isMediaRaw(file.path,before,ob))continue;
            total++;
            const after=ensureEntityLinksBlock(migrateEntities(before,ob));
            if(after!==before)edits.push({path:file.path,before,after});
        }
        for(const file of app.vault.getFiles().filter(f=>f.extension==='base' && f.path.startsWith('Кино/') && !/^Кино\/(Просмотры|Сезоны)\//.test(f.path))) {
            const before=await app.vault.read(file);
            const after=patchEntityBase(before,ob,app.vault.getName());
            if(after!==before)edits.push({path:file.path,before,after});
        }
        for(const [path,after] of Object.entries(SERVICE_PAGES)) {
            const file=app.vault.getAbstractFileByPath(path);
            if(file) {
                const text=await app.vault.read(file);
                if(!text.includes('<!-- KINO:ENTITY:V1 -->'))throw new Error('Служебная страница уже занята другим содержимым: '+path);
            } else edits.push({path,before:null,after});
        }
        const allChoices=[];
        function walk(items){for(const item of items||[]){allChoices.push(item);if(item.type==='Multi')walk(item.choices);}}
        walk(quickadd.settings.choices);
        const commands=[];
        for(const command of COMMANDS) {
            const present=allChoices.find(x=>x.name===command.name);
            if(present && present.id!==command.id)throw new Error('Команда с таким именем уже существует: '+command.name);
            if(!present)commands.push(command);
        }
        if(!edits.length&&!commands.length){new ob.Notice('Все три поля и команды уже обновлены.');return;}
        // Резервная копия до первой записи. Не создаем дополнительных Markdown-страниц.
        const backupPath=`${app.vault.configDir}/plugins/quickadd/kinoteka-entities-${Date.now()}.json`;
        const backup={version:1,at:new Date().toISOString(),edits,commands:commands.map(x=>x.id),applied:[]};
        await app.vault.adapter.write(backupPath,JSON.stringify(backup,null,2));
        for(const edit of edits) {
            const file=app.vault.getAbstractFileByPath(edit.path);
            if(edit.before===null) {
                if(file)throw new Error('Файл появился во время миграции: '+edit.path);
                await makeFolders(app,edit.path);await app.vault.create(edit.path,edit.after);
            } else {
                if(!file)throw new Error('Файл удален во время миграции: '+edit.path);
                await app.vault.process(file,text=>{
                    if(text!==edit.before)throw new Error('Файл изменен во время миграции: '+edit.path);
                    return edit.after;
                });
            }
            backup.applied.push(edit.path);
        }
        quickadd.settings.choices.push(...commands);
        await quickadd.saveSettings();
        for(const command of commands)quickadd.addCommandForChoice?.(command);
        await app.vault.adapter.write(backupPath,JSON.stringify(backup,null,2));
        let checked=0;
        for(const edit of edits) {
            const file=app.vault.getAbstractFileByPath(edit.path),actual=await app.vault.read(file);
            if(actual!==edit.after)throw new Error('Файл изменился после записи: '+edit.path);
            if(originalMediaPath(edit.path)) {
                if(migrateEntities(actual,ob)!==actual)throw new Error('Проверка нормализации не пройдена: '+edit.path);
                checked++;
            }
        }
        await qa.infoDialog('Готово',[
            `Карточек проверено: ${total}. Изменено: ${checked}.`,
            'Обновлены только Режисер, Актеры, Жанр. Остальной текст карточек сохранен.',
            'Добавлены три динамические страницы и четыре команды QuickAdd.',
            'В Bases теперь кликабельные имена. Старый Template остается на месте.',
            `Резервная копия: ${backupPath}`
        ]);
    } finally {note.hide?.();migrationRunning=false;}
};

function patchEntityBase(raw,ob,vaultName) {
    const data=ob.parseYaml(raw);
    if(!data||!Array.isArray(data.views))return raw;
    const relevant=JSON.stringify(data).match(/Режисер|Актеры|Жанр/);
    if(!relevant)return raw;
    const before=JSON.stringify(data);
    data.formulas||={};data.properties||={};
    for(const [field,meta] of Object.entries(ENTITY_META)) {
        data.formulas[meta.formula]=entityLinkFormula(field,meta.command,vaultName);
        data.properties['formula.'+meta.formula]={displayName:meta.label};
    }
    for(const view of data.views) {
        if(Array.isArray(view.order))view.order=view.order.map(key=>{
            const field=key.replace(/^note\./,'');return ENTITY_META[field]?'formula.'+ENTITY_META[field].formula:key;
        });
        if(view.type==='table') {
            view.order||=['file.name'];
            for(const meta of Object.values(ENTITY_META))if(!view.order.includes('formula.'+meta.formula))view.order.push('formula.'+meta.formula);
        }
    }
    return before===JSON.stringify(data)?raw:ob.stringifyYaml(data);
}
function entityLinkFormula(field,command,vaultName) {
    // Bases не предоставляет encodeURIComponent. Кодируем разделители query string
    // явно; Unicode в URL штатно кодируется обработчиком ссылки Obsidian.
    let value='value.toString()';
    for(const [from,to] of [['%','%25'],['&','%26'],['+','%2B'],['#','%23'],['?','%3F'],['=','%3D'],[' ','%20'],['"','%22'],["'",'%27'],['<','%3C'],['>','%3E'],['\n','%0A'],['\r','%0D'],['\t','%09']])value+=`.replace(${JSON.stringify(from)}, ${JSON.stringify(to)})`;
    const base='obsidian://quickadd?'+(vaultName?'vault='+encodeURIComponent(vaultName)+'&':'')+'choice='+encodeURIComponent(command)+'&value-entity=';
    return `list(note[${JSON.stringify(field)}]).filter(value != null && value != "").map(link(${JSON.stringify(base)} + ${value}, value))`;
}

const SERVICE_PAGES = {
  "Кино/_system/Режиссер.md": "---\nВыбрано: \"\"\n---\n\n<!-- KINO:ENTITY:V1 -->\n# Режиссер\n\n```dataviewjs\nconst selected = String(dv.current()[\"Выбрано\"] || \"\");\nif (!selected) {\n    dv.paragraph(\"Выбери имя в кинотеке или запусти соответствующую команду QuickAdd.\");\n} else {\n    dv.header(2, selected);\n    const rows = dv.pages('\"Кино\"').array().filter(p => {\n        if (/^Кино\\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\\//.test(p.file.path)) return false;\n        const tags = Array.isArray(p.tags) ? p.tags : [p.tags];\n        if (!tags.some(t => [\"movies\", \"serial\"].includes(String(t).replace(/^#/, \"\")))) return false;\n        const values = Array.isArray(p[\"Режисер\"]) ? p[\"Режисер\"] : [p[\"Режисер\"]];\n        return values.includes(selected);\n    });\n    const ratings = rows.map(p => p[\"Оценка\"]).filter(v => v != null && String(v).trim() !== \"\")\n        .map(v => Number(String(v).replace(\",\", \".\"))).filter(v => Number.isFinite(v) && v >= 1 && v <= 10);\n    dv.paragraph(\"Произведений: \" + rows.length + \" · Средняя моя оценка: \" +\n        (ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : \"нет оценок\"));\n}\n```\n\n```base\nfilters:\n  and:\n  - file.inFolder(\"Кино\")\n  - file.ext == \"md\"\n  - file.hasTag(\"movies\") || file.hasTag(\"serial\")\n  - '!file.inFolder(\"Кино/Просмотры\")'\n  - '!file.inFolder(\"Кино/Сезоны\")'\n  - '!file.inFolder(\"Кино/Франшизы\")'\n  - '!file.inFolder(\"Кино/Служебное\")'\n  - '!file.inFolder(\"Кино/_system\")'\n  - this.Выбрано != null && this.Выбрано != \"\"\n  - list(note[\"Режисер\"]).contains(this.Выбрано)\nformulas:\n  type: if(file.hasTag(\"serial\"), \"Сериал\", \"Фильм\")\n  rating: if(note.Оценка != null && note.Оценка.toString().trim() != \"\", number(note.Оценка), null)\n  imdb: if(note[\"Оценка Imdb\"] != null && note[\"Оценка Imdb\"].toString().trim() != \"\", number(note[\"Оценка Imdb\"]), null)\nproperties:\n  file.name:\n    displayName: Название\n  formula.type:\n    displayName: Тип\n  note.Релиз:\n    displayName: Год / релиз\n  formula.rating:\n    displayName: Моя оценка\n  formula.imdb:\n    displayName: IMDb\n  note.Франшиза:\n    displayName: Франшиза\nsummaries:\n  entity_average: values.filter(value != null).mean().round(2)\nviews:\n- type: table\n  name: Все\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n- type: table\n  name: Фильмы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"movies\") && !file.hasTag(\"serial\")\n- type: table\n  name: Сериалы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"serial\")\n- type: table\n  name: Лучшие\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - formula.rating >= 8\n```\n\n\"Лучшие\" - личная оценка от 8. Строки открывают исходные карточки.\n",
  "Кино/_system/Актер.md": "---\nВыбрано: \"\"\n---\n\n<!-- KINO:ENTITY:V1 -->\n# Актер\n\n```dataviewjs\nconst selected = String(dv.current()[\"Выбрано\"] || \"\");\nif (!selected) {\n    dv.paragraph(\"Выбери имя в кинотеке или запусти соответствующую команду QuickAdd.\");\n} else {\n    dv.header(2, selected);\n    const rows = dv.pages('\"Кино\"').array().filter(p => {\n        if (/^Кино\\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\\//.test(p.file.path)) return false;\n        const tags = Array.isArray(p.tags) ? p.tags : [p.tags];\n        if (!tags.some(t => [\"movies\", \"serial\"].includes(String(t).replace(/^#/, \"\")))) return false;\n        const values = Array.isArray(p[\"Актеры\"]) ? p[\"Актеры\"] : [p[\"Актеры\"]];\n        return values.includes(selected);\n    });\n    const ratings = rows.map(p => p[\"Оценка\"]).filter(v => v != null && String(v).trim() !== \"\")\n        .map(v => Number(String(v).replace(\",\", \".\"))).filter(v => Number.isFinite(v) && v >= 1 && v <= 10);\n    dv.paragraph(\"Произведений: \" + rows.length + \" · Средняя моя оценка: \" +\n        (ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : \"нет оценок\"));\n}\n```\n\n```base\nfilters:\n  and:\n  - file.inFolder(\"Кино\")\n  - file.ext == \"md\"\n  - file.hasTag(\"movies\") || file.hasTag(\"serial\")\n  - '!file.inFolder(\"Кино/Просмотры\")'\n  - '!file.inFolder(\"Кино/Сезоны\")'\n  - '!file.inFolder(\"Кино/Франшизы\")'\n  - '!file.inFolder(\"Кино/Служебное\")'\n  - '!file.inFolder(\"Кино/_system\")'\n  - this.Выбрано != null && this.Выбрано != \"\"\n  - list(note[\"Актеры\"]).contains(this.Выбрано)\nformulas:\n  type: if(file.hasTag(\"serial\"), \"Сериал\", \"Фильм\")\n  rating: if(note.Оценка != null && note.Оценка.toString().trim() != \"\", number(note.Оценка), null)\n  imdb: if(note[\"Оценка Imdb\"] != null && note[\"Оценка Imdb\"].toString().trim() != \"\", number(note[\"Оценка Imdb\"]), null)\nproperties:\n  file.name:\n    displayName: Название\n  formula.type:\n    displayName: Тип\n  note.Релиз:\n    displayName: Год / релиз\n  formula.rating:\n    displayName: Моя оценка\n  formula.imdb:\n    displayName: IMDb\n  note.Франшиза:\n    displayName: Франшиза\nsummaries:\n  entity_average: values.filter(value != null).mean().round(2)\nviews:\n- type: table\n  name: Все\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n- type: table\n  name: Фильмы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"movies\") && !file.hasTag(\"serial\")\n- type: table\n  name: Сериалы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"serial\")\n- type: table\n  name: Лучшие\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - formula.rating >= 8\n```\n\n\"Лучшие\" - личная оценка от 8. Строки открывают исходные карточки.\n",
  "Кино/_system/Жанр.md": "---\nВыбрано: \"\"\n---\n\n<!-- KINO:ENTITY:V1 -->\n# Жанр\n\n```dataviewjs\nconst selected = String(dv.current()[\"Выбрано\"] || \"\");\nif (!selected) {\n    dv.paragraph(\"Выбери имя в кинотеке или запусти соответствующую команду QuickAdd.\");\n} else {\n    dv.header(2, selected);\n    const rows = dv.pages('\"Кино\"').array().filter(p => {\n        if (/^Кино\\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\\//.test(p.file.path)) return false;\n        const tags = Array.isArray(p.tags) ? p.tags : [p.tags];\n        if (!tags.some(t => [\"movies\", \"serial\"].includes(String(t).replace(/^#/, \"\")))) return false;\n        const values = Array.isArray(p[\"Жанр\"]) ? p[\"Жанр\"] : [p[\"Жанр\"]];\n        return values.includes(selected);\n    });\n    const ratings = rows.map(p => p[\"Оценка\"]).filter(v => v != null && String(v).trim() !== \"\")\n        .map(v => Number(String(v).replace(\",\", \".\"))).filter(v => Number.isFinite(v) && v >= 1 && v <= 10);\n    dv.paragraph(\"Произведений: \" + rows.length + \" · Средняя моя оценка: \" +\n        (ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : \"нет оценок\"));\n}\n```\n\n```base\nfilters:\n  and:\n  - file.inFolder(\"Кино\")\n  - file.ext == \"md\"\n  - file.hasTag(\"movies\") || file.hasTag(\"serial\")\n  - '!file.inFolder(\"Кино/Просмотры\")'\n  - '!file.inFolder(\"Кино/Сезоны\")'\n  - '!file.inFolder(\"Кино/Франшизы\")'\n  - '!file.inFolder(\"Кино/Служебное\")'\n  - '!file.inFolder(\"Кино/_system\")'\n  - this.Выбрано != null && this.Выбрано != \"\"\n  - list(note[\"Жанр\"]).contains(this.Выбрано)\nformulas:\n  type: if(file.hasTag(\"serial\"), \"Сериал\", \"Фильм\")\n  rating: if(note.Оценка != null && note.Оценка.toString().trim() != \"\", number(note.Оценка), null)\n  imdb: if(note[\"Оценка Imdb\"] != null && note[\"Оценка Imdb\"].toString().trim() != \"\", number(note[\"Оценка Imdb\"]), null)\nproperties:\n  file.name:\n    displayName: Название\n  formula.type:\n    displayName: Тип\n  note.Релиз:\n    displayName: Год / релиз\n  formula.rating:\n    displayName: Моя оценка\n  formula.imdb:\n    displayName: IMDb\n  note.Франшиза:\n    displayName: Франшиза\nsummaries:\n  entity_average: values.filter(value != null).mean().round(2)\nviews:\n- type: table\n  name: Все\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n- type: table\n  name: Фильмы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"movies\") && !file.hasTag(\"serial\")\n- type: table\n  name: Сериалы\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - file.hasTag(\"serial\")\n- type: table\n  name: Лучшие\n  order:\n  - file.name\n  - formula.type\n  - note.Релиз\n  - formula.rating\n  - formula.imdb\n  - note.Франшиза\n  sort:\n  - property: formula.rating\n    direction: DESC\n  - property: file.name\n    direction: ASC\n  summaries:\n    file.name: Filled\n    formula.rating: entity_average\n  filters:\n    and:\n    - formula.rating >= 8\n```\n\n\"Лучшие\" - личная оценка от 8. Строки открывают исходные карточки.\n"
};
const COMMANDS = [
  {
    "id": "kinoteka-entity-director-v1",
    "name": "Кино - Открыть режиссера",
    "type": "Macro",
    "command": true,
    "runOnStartup": false,
    "macro": {
      "id": "kinoteka-entity-macro-director-v1",
      "name": "Кино - Открыть режиссера",
      "commands": [
        {
          "id": "kinoteka-entity-script-director-v1",
          "name": "open_kino_director",
          "type": "UserScript",
          "path": "скрипты/open_kino_director.js",
          "settings": {}
        }
      ]
    }
  },
  {
    "id": "kinoteka-entity-actor-v1",
    "name": "Кино - Открыть актера",
    "type": "Macro",
    "command": true,
    "runOnStartup": false,
    "macro": {
      "id": "kinoteka-entity-macro-actor-v1",
      "name": "Кино - Открыть актера",
      "commands": [
        {
          "id": "kinoteka-entity-script-actor-v1",
          "name": "open_kino_actor",
          "type": "UserScript",
          "path": "скрипты/open_kino_actor.js",
          "settings": {}
        }
      ]
    }
  },
  {
    "id": "kinoteka-entity-genre-v1",
    "name": "Кино - Открыть жанр",
    "type": "Macro",
    "command": true,
    "runOnStartup": false,
    "macro": {
      "id": "kinoteka-entity-macro-genre-v1",
      "name": "Кино - Открыть жанр",
      "commands": [
        {
          "id": "kinoteka-entity-script-genre-v1",
          "name": "open_kino_genre",
          "type": "UserScript",
          "path": "скрипты/open_kino_genre.js",
          "settings": {}
        }
      ]
    }
  }
];
const ENTITY_META = {
  "Режисер": {
    "formula": "entity_director",
    "command": "Кино - Открыть режиссера",
    "label": "Режиссер"
  },
  "Актеры": {
    "formula": "entity_actor",
    "command": "Кино - Открыть актера",
    "label": "Актер"
  },
  "Жанр": {
    "formula": "entity_genre",
    "command": "Кино - Открыть жанр",
    "label": "Жанр"
  }
};

function ensureEntityLinksBlock(raw) {
    const match = raw.match(/^(\ufeff?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/);
    if (!match) return raw;
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    const pattern = /(?:\r?\n)?^[ \t]*<!-- KINO:ENTITY:LINKS:V2 -->\r?\n```dataviewjs\r?\n[\s\S]*?^```[ \t]*(?:\r?\n|$)/m;
    const body = raw.slice(match[0].length).replace(pattern, "");
    return match[0] + ENTITY_LINKS_BLOCK.replace(/\n/g, newline) + newline + body;
}
