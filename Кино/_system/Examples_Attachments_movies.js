/* QuickAdd: User Script ПЕРЕД существующим Template/Capture. Шаблон сохраняется.
 * OMDb API Key сохраняется в прежних настройках. Ключ Kinopoisk Unofficial API встроен в скрипт.
 * Название в YAML остаётся оригинальным; имя файла берётся на русском.
 * Если OMDb/Wikidata/КП не дают полную карточку, запрашивается ID или ссылка КП.
 * Данные КП и состав сначала берутся через Kinopoisk Unofficial API; IMDb и резервные источники дополняют данные.
 * Успешный источник полностью заменяет поле. Имена в YAML всегда латиницей;
 * строки с ролями хранятся отдельно и выводятся по одной на строку в формате Role - Name.
 */
const API_KEY_OPTION = "OMDb API Key";
const KP_API_BASE = "https://kinopoiskapiunofficial.tech/api";
const KP_API_KEY = '18560e74-f0bf-4ca5-9efc-5a9ebb547268';
const ROOT = "Кино";
const SERIES = "Кино/Франшизы";
const RATING_PREDICTOR = "Кино/_system/predict_rating.js";
const RECOMMEND_PAGE = "Кино/_system/рекомендации.md";
const RECOMMEND_STATE = "Кино/_system/Прогноз/рекомендации_state.json";
const KINO_PERSON_ALIASES = {"Актеры":{"angelabassett":"Angela Bassett (Анджела Бассетт)","анджелабассетт":"Angela Bassett (Анджела Бассетт)","chrisferrarini":"Chris Ferrarini (Крис Феррарини)","крисферрарини":"Chris Ferrarini (Крис Феррарини)","erniesloman":"Ernie Sloman (Эрни Сломан)","эрнисломан":"Ernie Sloman (Эрни Сломан)","caryymizobe":"Cary Y. Mizobe (Кэри И. Мидзобэ)","кэриимидзобэ":"Cary Y. Mizobe (Кэри И. Мидзобэ)","mitchyapko":"Mitch Yapko (Митч Япко)","митчяпко":"Mitch Yapko (Митч Япко)","victorjaco":"Victor Jaco (Виктор Александр Яко)","викторалександряко":"Victor Jaco (Виктор Александр Яко)","aamirkhan":"Aamir Khan (Аамир Кхан)","аамиркхан":"Aamir Khan (Аамир Кхан)","aaronpoole":"Aaron Poole (Аарон Пул)","ааронпул":"Aaron Poole (Аарон Пул)","adriangrenier":"Adrian Grenier (Эдриан Гренье)","эдриангренье":"Adrian Grenier (Эдриан Гренье)","alainchabat":"Alain Chabat (Ален Шаба)","аленшаба":"Alain Chabat (Ален Шаба)","alaindelon":"Alain Delon (Ален Делон)","аленделон":"Alain Delon (Ален Делон)","alekseydemidov":"Aleksey Demidov (Алексей Демидов)","алексеидемидов":"Aleksey Demidov (Алексей Демидов)","allegraedwards":"Allegra Edwards (Аллегра Эдвардс)","аллеграэдвардс":"Allegra Edwards (Аллегра Эдвардс)","alyssadiaz":"Alyssa Diaz (Алисса Диас)","алиссадиас":"Alyssa Diaz (Алисса Диас)","andreariseborough":"Andrea Riseborough (Андреа Райзборо)","андреараизборо":"Andrea Riseborough (Андреа Райзборо)","andrewlincoln":"Andrew Lincoln (Эндрю Линкольн)","эндрюлинкольн":"Andrew Lincoln (Эндрю Линкольн)","andrewscott":"Andrew Scott (Эндрю Скотт)","эндрюскотт":"Andrew Scott (Эндрю Скотт)","andreyskorokhod":"Andrey Skorokhod (Андрей Скороход)","андреискороход":"Andrey Skorokhod (Андрей Скороход)","andyallo":"Andy Allo (Энди Алло)","эндиалло":"Andy Allo (Энди Алло)","andylau":"Andy Lau (Энди Лау)","эндилау":"Andy Lau (Энди Лау)","anjanavasan":"Anjana Vasan (Анджана Васан)","анджанавасан":"Anjana Vasan (Анджана Васан)","annehathaway":"Anne Hathaway (Энн Хэтэуэй)","эннхэтэуэи":"Anne Hathaway (Энн Хэтэуэй)","anushkasharma":"Anushka Sharma (Анушка Шарма)","анушкашарма":"Anushka Sharma (Анушка Шарма)","arminmuellerstahl":"Armin Mueller-Stahl (Армин Мюллер-Шталь)","арминмюллершталь":"Armin Mueller-Stahl (Армин Мюллер-Шталь)","arnoldschwarzenegger":"Arnold Schwarzenegger (Арнольд Шварценеггер)","арнольдшварценеггер":"Arnold Schwarzenegger (Арнольд Шварценеггер)","austinabrams":"Austin Abrams (Остин Абрамс)","остинабрамс":"Austin Abrams (Остин Абрамс)","baedoona":"Bae Doona (Пэ Ду-на)","пэдуна":"Bae Doona (Пэ Ду-на)","бэдуна":"Bae Doona (Пэ Ду-на)","barrypepper":"Barry Pepper (Барри Пеппер)","баррипеппер":"Barry Pepper (Барри Пеппер)","benoitmagimel":"Benoît Magimel (Бенуа Мажимель)","бенуамажимель":"Benoît Magimel (Бенуа Мажимель)","billskarsgard":"Bill Skarsgård (Билл Скарсгард)","биллскарсгард":"Bill Skarsgård (Билл Скарсгард)","billyconnolly":"Billy Connolly (Билли Коннолли)","билликоннолли":"Billy Connolly (Билли Коннолли)","blakelively":"Blake Lively (Блейк Лайвли)","блеиклаивли":"Blake Lively (Блейк Лайвли)","bobgunton":"Bob Gunton (Боб Гантон)","бобгантон":"Bob Gunton (Боб Гантон)","bokeemwoodbine":"Bokeem Woodbine (Боким Вудбайн)","бокимвудбаин":"Bokeem Woodbine (Боким Вудбайн)","bradpitt":"Brad Pitt (Брэд Питт)","брэдпитт":"Brad Pitt (Брэд Питт)","брэдпит":"Brad Pitt (Брэд Питт)","bradleycooper":"Bradley Cooper (Брэдли Купер)","брэдликупер":"Bradley Cooper (Брэдли Купер)","brinnakelly":"Brinna Kelly (Бринна Келли)","бриннакелли":"Brinna Kelly (Бринна Келли)","bryancranston":"Bryan Cranston (Брайан Крэнстон)","браианкрэнстон":"Bryan Cranston (Брайан Крэнстон)","camilamendes":"Camila Mendes (Камила Мендес)","камиламендес":"Camila Mendes (Камила Мендес)","carlosmanuelvesga":"Carlos-Manuel Vesga (Карлос-Мануэль Весга)","карлосмануэльвесга":"Carlos-Manuel Vesga (Карлос-Мануэль Весга)","cateblanchett":"Cate Blanchett (Кейт Бланшетт)","кеитбланшетт":"Cate Blanchett (Кейт Бланшетт)","charliebarnett":"Charlie Barnett (Чарли Барнетт)","чарлибарнетт":"Charlie Barnett (Чарли Барнетт)","charlotteritchie":"Charlotte Ritchie (Шарлотта Ритчи)","шарлоттаритчи":"Charlotte Ritchie (Шарлотта Ритчи)","christianbale":"Christian Bale (Кристиан Бэйл)","кристианбэил":"Christian Bale (Кристиан Бэйл)","christophwaltz":"Christoph Waltz (Кристоф Вальц)","кристофвальц":"Christoph Waltz (Кристоф Вальц)","ciaranhinds":"Ciarán Hinds (Киран Хайндс)","киранхаиндс":"Ciarán Hinds (Киран Хайндс)","cliffcurtis":"Cliff Curtis (Клифф Кёртис)","клиффкертис":"Cliff Curtis (Клифф Кёртис)","cliffordbanagale":"Clifford Bañagale (Клиффорд Баньягале)","клиффордбаньягале":"Clifford Bañagale (Клиффорд Баньягале)","clinteastwood":"Clint Eastwood (Клинт Иствуд)","клинтиствуд":"Clint Eastwood (Клинт Иствуд)","colehauser":"Cole Hauser (Коул Хаузер)","коулхаузер":"Cole Hauser (Коул Хаузер)","colinfarrell":"Colin Farrell (Колин Фаррелл)","колинфаррелл":"Colin Farrell (Колин Фаррелл)","common":"Common (Коммон)","коммон":"Common (Коммон)","craigbierko":"Craig Bierko (Крэйг Бирко)","крэигбирко":"Craig Bierko (Крэйг Бирко)","cristinmilioti":"Cristin Milioti (Кристин Милиоти)","кристинмилиоти":"Cristin Milioti (Кристин Милиоти)","dafnekeen":"Dafne Keen (Дафни Кин)","дафникин":"Dafne Keen (Дафни Кин)","dakotafanning":"Dakota Fanning (Дакота Фаннинг)","дакотафаннинг":"Dakota Fanning (Дакота Фаннинг)","damsonidris":"Damson Idris (Дэмсон Идрис)","дэмсонидрис":"Damson Idris (Дэмсон Идрис)","danaigurira":"Danai Gurira (Данай Гурира)","данаигурира":"Danai Gurira (Данай Гурира)","davefranco":"Dave Franco (Дэйв Франко)","дэивфранко":"Dave Franco (Дэйв Франко)","demimoore":"Demi Moore (Деми Мур)","демимур":"Demi Moore (Деми Мур)","dennisquaid":"Dennis Quaid (Деннис Куэйд)","деннискуэид":"Dennis Quaid (Деннис Куэйд)","denzelwashington":"Denzel Washington (Дензел Вашингтон)","дензелвашингтон":"Denzel Washington (Дензел Вашингтон)","dolphlundgren":"Dolph Lundgren (Дольф Лундгрен)","дольфлундгрен":"Dolph Lundgren (Дольф Лундгрен)","donnieyen":"Donnie Yen (Донни Йен)","доннииен":"Donnie Yen (Донни Йен)","dougrayscott":"Dougray Scott (Дугрей Скотт)","дугреискотт":"Dougray Scott (Дугрей Скотт)","eddieredmayne":"Eddie Redmayne (Эдди Редмэйн)","эддиредмэин":"Eddie Redmayne (Эдди Редмэйн)","eizagonzalez":"Eiza González (Эйса Гонсалес)","эисагонсалес":"Eiza González (Эйса Гонсалес)","eleanormatsuura":"Eleanor Matsuura (Элинор Мацуура)","элинормацуура":"Eleanor Matsuura (Элинор Мацуура)","elliotpage":"Elliot Page (Эллиот Пейдж)","эллиотпеидж":"Elliot Page (Эллиот Пейдж)","erickeenleyside":"Eric Keenleyside (Эрик Кинсайд)","эриккинсаид":"Eric Keenleyside (Эрик Кинсайд)","ethanhawke":"Ethan Hawke (Итан Хоук)","итанхоук":"Ethan Hawke (Итан Хоук)","evgeniytsyganov":"Evgeniy Tsyganov (Евгений Цыганов)","евгениицыганов":"Evgeniy Tsyganov (Евгений Цыганов)","florencepugh":"Florence Pugh (Флоренс Пью)","флоренспью":"Florence Pugh (Флоренс Пью)","frankdillane":"Frank Dillane (Фрэнк Диллэйн)","фрэнкдиллэин":"Frank Dillane (Фрэнк Диллэйн)","gabrielleone":"Gabriel Leone (Габриэл Леоне)","габриэллеоне":"Gabriel Leone (Габриэл Леоне)","garyoldman":"Gary Oldman (Гэри Олдман)","гэриолдман":"Gary Oldman (Гэри Олдман)","гариолдман":"Gary Oldman (Гэри Олдман)","genarowlands":"Gena Rowlands (Джина Роулендс)","джинароулендс":"Gena Rowlands (Джина Роулендс)","georgeclooney":"George Clooney (Джордж Клуни)","джорджклуни":"George Clooney (Джордж Клуни)","geraintwyndavies":"Geraint Wyn Davies (Джерент Уин Дэйвис)","джерентуиндэивис":"Geraint Wyn Davies (Джерент Уин Дэйвис)","gerardbutler":"Gerard Butler (Джерард Батлер)","джерардбатлер":"Gerard Butler (Джерард Батлер)","ginoanthonypesi":"Gino Anthony Pesi (Джино Энтони Пези)","джиноэнтонипези":"Gino Anthony Pesi (Джино Энтони Пези)","gretalee":"Greta Lee (Грета Ли)","гретали":"Greta Lee (Грета Ли)","gretchenmol":"Gretchen Mol (Гретхен Мол)","гретхенмол":"Gretchen Mol (Гретхен Мол)","gustafhammarsten":"Gustaf Hammarsten (Густаф Хаммарстен)","густафхаммарстен":"Gustaf Hammarsten (Густаф Хаммарстен)","gwynethpaltrow":"Gwyneth Paltrow (Гвинет Пэлтроу)","гвинетпэлтроу":"Gwyneth Paltrow (Гвинет Пэлтроу)","halleberry":"Halle Berry (Холли Берри)","холлиберри":"Halle Berry (Холли Берри)","harrisonford":"Harrison Ford (Харрисон Форд)","харрисонфорд":"Harrison Ford (Харрисон Форд)","heweiyu":"Hewei Yu (Юй Хэвэй)","юихэвэи":"Hewei Yu (Юй Хэвэй)","ianhart":"Ian Hart (Иэн Харт)","иэнхарт":"Ian Hart (Иэн Харт)","idriselba":"Idris Elba (Идрис Эльба)","идрисэльба":"Idris Elba (Идрис Эльба)","ikouwais":"Iko Uwais (Ико Ювайс)","икоюваис":"Iko Uwais (Ико Ювайс)","jksimmons":"J.K. Simmons (Дж.К. Симмонс)","джксиммонс":"J.K. Simmons (Дж.К. Симмонс)","jacindabarrett":"Jacinda Barrett (Джасинда Барретт)","джасиндабарретт":"Jacinda Barrett (Джасинда Барретт)","jackalcott":"Jack Alcott (Джек Элкотт)","джекэлкотт":"Jack Alcott (Джек Элкотт)","jamesgarner":"James Garner (Джеймс Гарнер)","джеимсгарнер":"James Garner (Джеймс Гарнер)","jamesmarsden":"James Marsden (Джеймс Марсден)","джеимсмарсден":"James Marsden (Джеймс Марсден)","jamesortiz":"James Ortiz (Джеймс Ортис)","джеимсортис":"James Ortiz (Джеймс Ортис)","jamieclayton":"Jamie Clayton (Джейми Клейтон)","джеимиклеитон":"Jamie Clayton (Джейми Клейтон)","jaredpadalecki":"Jared Padalecki (Джаред Падалеки)","джаредпадалеки":"Jared Padalecki (Джаред Падалеки)","jasonstuart":"Jason Stuart (Джейсон Стюарт)","джеисонстюарт":"Jason Stuart (Джейсон Стюарт)","javierbardem":"Javier Bardem (Хавьер Бардем)","хавьербардем":"Javier Bardem (Хавьер Бардем)","jazsinclair":"Jaz Sinclair (Джаз Синклер)","джазсинклер":"Jaz Sinclair (Джаз Синклер)","jeffreydeanmorgan":"Jeffrey Dean Morgan (Джеффри Дин Морган)","джеффридинморган":"Jeffrey Dean Morgan (Джеффри Дин Морган)","jennifergarner":"Jennifer Garner (Дженнифер Гарнер)","дженнифергарнер":"Jennifer Garner (Дженнифер Гарнер)","jensenackles":"Jensen Ackles (Дженсен Эклз)","дженсенэклз":"Jensen Ackles (Дженсен Эклз)","jesseeisenberg":"Jesse Eisenberg (Джесси Айзенберг)","джессиаизенберг":"Jesse Eisenberg (Джесси Айзенберг)","jimbeaver":"Jim Beaver (Джим Бивер)","джимбивер":"Jim Beaver (Джим Бивер)","jimcarrey":"Jim Carrey (Джим Керри)","джимкерри":"Jim Carrey (Джим Керри)","jinseonkyu":"Jin Seon-kyu (Чин Сон-гю)","чинсонгю":"Jin Seon-kyu (Чин Сон-гю)","jingwu":"Jing Wu (У Цзин)","уцзин":"Jing Wu (У Цзин)","johncena":"John Cena (Джон Сина)","джонсина":"John Cena (Джон Сина)","johnkrasinski":"John Krasinski (Джон Красински)","джонкрасински":"John Krasinski (Джон Красински)","johnmalkovich":"John Malkovich (Джон Малкович)","джонмалкович":"John Malkovich (Джон Малкович)","johnnyflynn":"Johnny Flynn (Джонни Флинн)","джоннифлинн":"Johnny Flynn (Джонни Флинн)","joshlucas":"Josh Lucas (Джош Лукас)","джошлукас":"Josh Lucas (Джош Лукас)","jovanadepo":"Jovan Adepo (Джован Адепо)","джованадепо":"Jovan Adepo (Джован Адепо)","judelaw":"Jude Law (Джуд Лоу)","джудлоу":"Jude Law (Джуд Лоу)","julialouisdreyfus":"Julia Louis-Dreyfus (Джулия Луис-Дрейфус)","джулиялуисдреифус":"Julia Louis-Dreyfus (Джулия Луис-Дрейфус)","juliaroberts":"Julia Roberts (Джулия Робертс)","джулияробертс":"Julia Roberts (Джулия Робертс)","justintheroux":"Justin Theroux (Джастин Теру)","джастинтеру":"Justin Theroux (Джастин Теру)","karolinawydra":"Karolina Wydra (Каролина Выдра)","каролинавыдра":"Karolina Wydra (Каролина Выдра)","karolineeichhorn":"Karoline Eichhorn (Каролине Айххорн)","каролинеаиххорн":"Karoline Eichhorn (Каролине Айххорн)","kayascodelario":"Kaya Scodelario (Кая Скоделарио)","каяскоделарио":"Kaya Scodelario (Кая Скоделарио)","kenwatanabe":"Ken Watanabe (Кэн Ватанабэ)","кэнватанабэ":"Ken Watanabe (Кэн Ватанабэ)","kentoyamazaki":"Kento Yamazaki (Кэнто Ямазаки)","кэнтоямазаки":"Kento Yamazaki (Кэнто Ямазаки)","kellyreilly":"Kelly Reilly (Келли Райлли)","келлираилли":"Kelly Reilly (Келли Райлли)","kimbyeongcheol":"Kim Byeong-cheol (Ким Бён-чхоль)","кимбенчхоль":"Kim Byeong-cheol (Ким Бён-чхоль)","kimdickens":"Kim Dickens (Ким Диккенс)","кимдиккенс":"Kim Dickens (Ким Диккенс)","kimhyejun":"Kim Hye-jun (Ким Хе-джун)","кимхеджун":"Kim Hye-jun (Ким Хе-джун)","kimtaeri":"Kim Tae-ri (Ким Тхэ-ри)","кимтхэри":"Kim Tae-ri (Ким Тхэ-ри)","kitconnor":"Kit Connor (Кит Коннор)","китконнор":"Kit Connor (Кит Коннор)","kitharington":"Kit Harington (Кит Харингтон)","китхарингтон":"Kit Harington (Кит Харингтон)","kurtrussell":"Kurt Russell (Курт Рассел)","куртрассел":"Kurt Russell (Курт Рассел)","lashanalynch":"Lashana Lynch (Лашана Линч)","лашаналинч":"Lashana Lynch (Лашана Линч)","laurencohan":"Lauren Cohan (Лорен Коэн)","лоренкоэн":"Lauren Cohan (Лорен Коэн)","laurencefishburne":"Laurence Fishburne (Лоренс Фишбёрн)","лоренсфишберн":"Laurence Fishburne (Лоренс Фишбёрн)","leejaewook":"Lee Jae-wook (Ли Джэ-ук)","лиджэук":"Lee Jae-wook (Ли Джэ-ук)","leejunho":"Lee Jun-ho (Ли Джун-хо)","лиджунхо":"Lee Jun-ho (Ли Джун-хо)","lenaheadey":"Lena Headey (Лена Хиди)","ленахиди":"Lena Headey (Лена Хиди)","lesliebibb":"Leslie Bibb (Лесли Бибб)","леслибибб":"Leslie Bibb (Лесли Бибб)","lesliemann":"Leslie Mann (Лесли Манн)","леслиманн":"Leslie Mann (Лесли Манн)","liamcunningham":"Liam Cunningham (Лиам Каннингэм)","лиамканнингэм":"Liam Cunningham (Лиам Каннингэм)","liamhemsworth":"Liam Hemsworth (Лиам Хемсворт)","лиамхемсворт":"Liam Hemsworth (Лиам Хемсворт)","lindacardellini":"Linda Cardellini (Линда Карделлини)","линдакарделлини":"Linda Cardellini (Линда Карделлини)","lisavicari":"Lisa Vicari (Лиза Викари)","лизавикари":"Lisa Vicari (Лиза Викари)","lizzebroadway":"Lizze Broadway (Лиззи Бродвей)","лиззибродвеи":"Lizze Broadway (Лиззи Бродвей)","louishofmann":"Louis Hofmann (Луис Хофманн)","луисхофманн":"Louis Hofmann (Луис Хофманн)","luyizhang":"Luyi Zhang (Чжан Луйи)","чжанлуии":"Luyi Zhang (Чжан Луйи)","leadrucker":"Léa Drucker (Леа Дрюкер)","леадрюкер":"Léa Drucker (Леа Дрюкер)","maddiephillips":"Maddie Phillips (Мэдди Филлипс)","мэддифиллипс":"Maddie Phillips (Мэдди Филлипс)","madhavan":"Madhavan (Мадхаван)","мадхаван":"Madhavan (Мадхаван)","mahershalaali":"Mahershala Ali (Махершала Али)","махершалаали":"Mahershala Ali (Махершала Али)","mahinanapoleon":"Mahina Napoleon (Махина Наполеон)","махинанаполеон":"Mahina Napoleon (Махина Наполеон)","malikzidi":"Malik Zidi (Малик Зиди)","маликзиди":"Malik Zidi (Малик Зиди)","mantatng":"Man-Tat Ng (Нг Мань-Тат)","нгманьтат":"Man-Tat Ng (Нг Мань-Тат)","margaretqualley":"Margaret Qualley (Маргарет Куэлли)","маргареткуэлли":"Margaret Qualley (Маргарет Куэлли)","marielaforet":"Marie Laforêt (Мари Лафоре)","марилафоре":"Marie Laforêt (Мари Лафоре)","markruffalo":"Mark Ruffalo (Марк Руффало)","маркруффало":"Mark Ruffalo (Марк Руффало)","markwahlberg":"Mark Wahlberg (Марк Уолберг)","маркуолберг":"Mark Wahlberg (Марк Уолберг)","mathieuamalric":"Mathieu Amalric (Матьё Амальрик)","матьеамальрик":"Mathieu Amalric (Матьё Амальрик)","mattdamon":"Matt Damon (Мэтт Дэймон)","мэттдэимон":"Matt Damon (Мэтт Дэймон)","mattmella":"Matt Mella (Мэтт Мелла)","мэттмелла":"Matt Mella (Мэтт Мелла)","matthewbroderick":"Matthew Broderick (Мэттью Бродерик)","мэттьюбродерик":"Matthew Broderick (Мэттью Бродерик)","mauriceronet":"Maurice Ronet (Морис Роне)","морисроне":"Maurice Ronet (Морис Роне)","mauriciohenao":"Mauricio Hénao (Маурисио Энао)","маурисиоэнао":"Mauricio Hénao (Маурисио Энао)","mayahawke":"Maya Hawke (Майя Хоук)","маияхоук":"Maya Hawke (Майя Хоук)","melgibson":"Mel Gibson (Мэл Гибсон)","мэлгибсон":"Mel Gibson (Мэл Гибсон)","melissamcbride":"Melissa McBride (Мелисса Макбрайд)","мелиссамакбраид":"Melissa McBride (Мелисса Макбрайд)","merylstreep":"Meryl Streep (Мэрил Стрип)","мэрилстрип":"Meryl Streep (Мэрил Стрип)","michaelchall":"Michael C. Hall (Майкл Си Холл)","маиклсихолл":"Michael C. Hall (Майкл Си Холл)","michaelcera":"Michael Cera (Майкл Сера)","маиклсера":"Michael Cera (Майкл Сера)","michaelironside":"Michael Ironside (Майкл Айронсайд)","маиклаиронсаид":"Michael Ironside (Майкл Айронсайд)","michelledockery":"Michelle Dockery (Мишель Докери)","мишельдокери":"Michelle Dockery (Мишель Докери)","michellemonaghan":"Michelle Monaghan (Мишель Монахэн)","мишельмонахэн":"Michelle Monaghan (Мишель Монахэн)","michielhuisman":"Michiel Huisman (Михил Хёйсман)","михилхеисман":"Michiel Huisman (Михил Хёйсман)","mikhailevlanov":"Mikhail Evlanov (Михаил Евланов)","михаилевланов":"Mikhail Evlanov (Михаил Евланов)","milakunis":"Mila Kunis (Мила Кунис)","милакунис":"Mila Kunis (Мила Кунис)","monasingh":"Mona Singh (Мона Сингх)","монасингх":"Mona Singh (Мона Сингх)","morenabaccarin":"Morena Baccarin (Морена Баккарин)","моренабаккарин":"Morena Baccarin (Морена Баккарин)","morganfreeman":"Morgan Freeman (Морган Фриман)","морганфриман":"Morgan Freeman (Морган Фриман)","melanielaurent":"Mélanie Laurent (Мелани Лоран)","меланилоран":"Mélanie Laurent (Мелани Лоран)","natalieportman":"Natalie Portman (Натали Портман)","наталипортман":"Natalie Portman (Натали Портман)","natashalyonne":"Natasha Lyonne (Наташа Лионн)","наташалионн":"Natasha Lyonne (Наташа Лионн)","nathanfillion":"Nathan Fillion (Нэйтан Филлион)","нэитанфиллион":"Nathan Fillion (Нэйтан Филлион)","nicolascage":"Nicolas Cage (Николас Кейдж)","николаскеидж":"Nicolas Cage (Николас Кейдж)","nijiromurakami":"Nijirô Murakami (Нидзиро Мураками)","нидзиромураками":"Nijirô Murakami (Нидзиро Мураками)","normanreedus":"Norman Reedus (Норман Ридус)","норманридус":"Norman Reedus (Норман Ридус)","olegvasilkov":"Oleg Vasilkov (Олег Васильков)","олегвасильков":"Oleg Vasilkov (Олег Васильков)","owenwilson":"Owen Wilson (Оуэн Уилсон)","оуэнуилсон":"Owen Wilson (Оуэн Уилсон)","paapaessiedu":"Paapa Essiedu (Паапа Эссьеду)","паапаэссьеду":"Paapa Essiedu (Паапа Эссьеду)","parksodam":"Park So-dam (Пак Со-дам)","паксодам":"Park So-dam (Пак Со-дам)","pelageyanevzorova":"Pelageya Nevzorova (Пелагея Невзорова)","пелагеяневзорова":"Pelageya Nevzorova (Пелагея Невзорова)","pennbadgley":"Penn Badgley (Пенн Бэджли)","пеннбэджли":"Penn Badgley (Пенн Бэджли)","philipkeung":"Philip Keung (Филип Кёнг)","филипкенг":"Philip Keung (Филип Кёнг)","pollyannamcintosh":"Pollyanna McIntosh (Поллианна Макинтош)","поллианнамакинтош":"Pollyanna McIntosh (Поллианна Макинтош)","priyankachoprajonas":"Priyanka Chopra Jonas (Приянка Чопра Джонас)","приянкачопраджонас":"Priyanka Chopra Jonas (Приянка Чопра Джонас)","rachelmcadams":"Rachel McAdams (Рэйчел Макадамс)","рэичелмакадамс":"Rachel McAdams (Рэйчел Макадамс)","rheaseehorn":"Rhea Seehorn (Рея Сихорн)","реясихорн":"Rhea Seehorn (Рея Сихорн)","richardtjones":"Richard T. Jones (Ричард Т. Джонс)","ричардтджонс":"Richard T. Jones (Ричард Т. Джонс)","robbieamell":"Robbie Amell (Робби Амелл)","роббиамелл":"Robbie Amell (Робби Амелл)","robindunne":"Robin Dunne (Робин Данн)","робинданн":"Robin Dunne (Робин Данн)","rogerdalefloyd":"Roger Dale Floyd (Роджер Дейл Флойд)","роджердеилфлоид":"Roger Dale Floyd (Роджер Дейл Флойд)","romainlevi":"Romain Levi (Ромен Леви)","роменлеви":"Romain Levi (Ромен Леви)","romangriffindavis":"Roman Griffin Davis (Роман Гриффин Дэвис)","романгриффиндэвис":"Roman Griffin Davis (Роман Гриффин Дэвис)","ruthwilson":"Ruth Wilson (Рут Уилсон)","рутуилсон":"Ruth Wilson (Рут Уилсон)","ryangosling":"Ryan Gosling (Райан Гослинг)","раиангослинг":"Ryan Gosling (Райан Гослинг)","sachabaroncohen":"Sacha Baron Cohen (Саша Барон Коэн)","сашабаронкоэн":"Sacha Baron Cohen (Саша Барон Коэн)","samworthington":"Sam Worthington (Сэм Уортингтон)","сэмуортингтон":"Sam Worthington (Сэм Уортингтон)","sandrabullock":"Sandra Bullock (Сандра Буллок)","сандрабуллок":"Sandra Bullock (Сандра Буллок)","sandrahuller":"Sandra Hüller (Сандра Хюллер)","сандрахюллер":"Sandra Hüller (Сандра Хюллер)","sanjaydutt":"Sanjay Dutt (Санджай Датт)","санджаидатт":"Sanjay Dutt (Санджай Датт)","scottglenn":"Scott Glenn (Скотт Гленн)","скоттгленн":"Scott Glenn (Скотт Гленн)","sebastianstan":"Sebastian Stan (Себастиан Стэн)","себастианстэн":"Sebastian Stan (Себастиан Стэн)","seoinguk":"Seo In-guk (Со Ин-гук)","соингук":"Seo In-guk (Со Ин-гук)","sharonstone":"Sharon Stone (Шэрон Стоун)","шэронстоун":"Sharon Stone (Шэрон Стоун)","sigourneyweaver":"Sigourney Weaver (Сигурни Уивер)","сигурниуивер":"Sigourney Weaver (Сигурни Уивер)","songjoongki":"Song Joong-ki (Сон Джун-ги)","сонджунги":"Song Joong-ki (Сон Джун-ги)","sophiadimartino":"Sophia Di Martino (София Ди Мартино)","софиядимартино":"Sophia Di Martino (София Ди Мартино)","steveaustin":"Steve Austin (Стив Остин)","стивостин":"Steve Austin (Стив Остин)","taotsuchiya":"Tao Tsuchiya (Тао Цутия)","таоцутия":"Tao Tsuchiya (Тао Цутия)","taylourpaige":"Taylour Paige (Тейлор Пейдж)","теилорпеидж":"Taylour Paige (Тейлор Пейдж)","timrobbins":"Tim Robbins (Тим Роббинс)","тимроббинс":"Tim Robbins (Тим Роббинс)","tinadesai":"Tina Desai (Тина Десай)","тинадесаи":"Tina Desai (Тина Десай)","tomcruise":"Tom Cruise (Том Круз)","томкруз":"Tom Cruise (Том Круз)","tomhiddleston":"Tom Hiddleston (Том Хиддлстон)","томхиддлстон":"Tom Hiddleston (Том Хиддлстон)","tophergrace":"Topher Grace (Тофер Грейс)","тофергреис":"Topher Grace (Тофер Грейс)","umathurman":"Uma Thurman (Ума Турман)","уматурман":"Uma Thurman (Ума Турман)","valeriyafedorovich":"Valeriya Fedorovich (Валерия Федорович)","валерияфедорович":"Valeriya Fedorovich (Валерия Федорович)","victoriapedretti":"Victoria Pedretti (Виктория Педретти)","викторияпедретти":"Victoria Pedretti (Виктория Педретти)","viggomortensen":"Viggo Mortensen (Вигго Мортенсен)","виггомортенсен":"Viggo Mortensen (Вигго Мортенсен)","williamshatner":"William Shatner (Уильям Шэтнер)","уильямшэтнер":"William Shatner (Уильям Шэтнер)","woodyharrelson":"Woody Harrelson (Вуди Харрельсон)","вудихаррельсон":"Woody Harrelson (Вуди Харрельсон)","yanmanzizhu":"Yanmanzi Zhu (Чжу Яньманьцзы)","чжуяньманьцзы":"Yanmanzi Zhu (Чжу Яньманьцзы)","yahyaabdulmateenii":"Yahya Abdul-Mateen II (Яхья Абдул-Матин II)","яхьяабдулматинii":"Yahya Abdul-Mateen II (Яхья Абдул-Матин II)","yisha":"Yi Sha (И Ша)","иша":"Yi Sha (И Ша)","yongjianlin":"Yongjian Lin (Линь Юнцзянь)","линьюнцзянь":"Yongjian Lin (Линь Юнцзянь)","yuliyaperesild":"Yuliya Peresild (Юлия Пересильд)","юлияпересильд":"Yuliya Peresild (Юлия Пересильд)","zhannaepple":"Zhanna Epple (Жанна Эппле)","жаннаэппле":"Zhanna Epple (Жанна Эппле)","zhiwang":"Zhi Wang (Ван Чжи)","ванчжи":"Zhi Wang (Ван Чжи)","zoesaldana":"Zoe Saldaña (Зои Салдана)","зоисалдана":"Zoe Saldaña (Зои Салдана)"},"Режисер":{"brettscottermilio":"Brett Scott Ermilio (Бретт Скотт Эрмилио)","бреттскоттэрмилио":"Brett Scott Ermilio (Бретт Скотт Эрмилио)","alexandreaja":"Alexandre Aja (Александр Ажа)","александража":"Alexandre Aja (Александр Ажа)","amanchang":"Aman Chang (Аман Чан)","аманчан":"Aman Chang (Аман Чан)","чанминь":"Aman Chang (Аман Чан)","anthonyminghella":"Anthony Minghella (Энтони Мингелла)","энтонимингелла":"Anthony Minghella (Энтони Мингелла)","antoinefuqua":"Antoine Fuqua (Антуан Фукуа)","антуанфукуа":"Antoine Fuqua (Антуан Фукуа)","benstiller":"Ben Stiller (Бен Стиллер)","бенстиллер":"Ben Stiller (Бен Стиллер)","bobgale":"Bob Gale (Боб Гейл)","бобгеил":"Bob Gale (Боб Гейл)","christophermiller":"Christopher Miller (Кристофер Миллер)","кристофермиллер":"Christopher Miller (Кристофер Миллер)","clinteastwood":"Clint Eastwood (Клинт Иствуд)","клинтиствуд":"Clint Eastwood (Клинт Иствуд)","coraliefargeat":"Coralie Fargeat (Корали Фаржа)","коралифаржа":"Coralie Fargeat (Корали Фаржа)","dchamilton":"D.C. Hamilton (Д. С. Хэмилтон)","дсхэмилтон":"D.C. Hamilton (Д. С. Хэмилтон)","davidfrankel":"David Frankel (Дэвид Фрэнкел)","дэвидфрэнкел":"David Frankel (Дэвид Фрэнкел)","edwardzwick":"Edward Zwick (Эдвард Цвик)","эдвардцвик":"Edward Zwick (Эдвард Цвик)","frankdarabont":"Frank Darabont (Фрэнк Дарабонт)","фрэнкдарабонт":"Frank Darabont (Фрэнк Дарабонт)","frantgwo":"Frant Gwo (Го Фань)","гофань":"Frant Gwo (Го Фань)","garyross":"Gary Ross (Гэри Росс)","гэриросс":"Gary Ross (Гэри Росс)","guyritchie":"Guy Ritchie (Гай Ричи)","гаиричи":"Guy Ritchie (Гай Ричи)","ilyanaishuller":"Ilya Naishuller (Илья Найшуллер)","ильянаишуллер":"Ilya Naishuller (Илья Найшуллер)","jakeschreier":"Jake Schreier (Джейк Шрейер)","джеикшреиер":"Jake Schreier (Джейк Шрейер)","jamescameron":"James Cameron (Джеймс Кэмерон)","джеимскэмерон":"James Cameron (Джеймс Кэмерон)","jasoncabell":"Jason Cabell (Джейсон Кабелл)","джеисонкабелл":"Jason Cabell (Джейсон Кабелл)","jasonkwan":"Jason Kwan (Джейсон Кван)","джеисонкван":"Jason Kwan (Джейсон Кван)","jasonreitman":"Jason Reitman (Джейсон Райтман)","джеисонраитман":"Jason Reitman (Джейсон Райтман)","jenniferkaytinrobinson":"Jennifer Kaytin Robinson (Дженнифер Кейтин Робинсон)","дженниферкеитинробинсон":"Jennifer Kaytin Robinson (Дженнифер Кейтин Робинсон)","jessevjohnson":"Jesse V. Johnson (Джесси Джонсон)","джессиджонсон":"Jesse V. Johnson (Джесси Джонсон)","jingwong":"Jing Wong (Вонг Цзин)","вонгцзин":"Jing Wong (Вонг Цзин)","вонгджин":"Jing Wong (Вонг Цзин)","jonmchu":"Jon M. Chu (Джон М. Чу)","джонмчу":"Jon M. Chu (Джон М. Чу)","josefrusnak":"Josef Rusnak (Йозеф Руснак)","иозефруснак":"Josef Rusnak (Йозеф Руснак)","josephkosinski":"Joseph Kosinski (Джозеф Косински)","джозефкосински":"Joseph Kosinski (Джозеф Косински)","julianfarino":"Julian Farino (Джулиан Фарино)","джулианфарино":"Julian Farino (Джулиан Фарино)","larrycharles":"Larry Charles (Ларри Чарльз)","ларричарльз":"Larry Charles (Ларри Чарльз)","leetolandkrieger":"Lee Toland Krieger (Ли Толанд Кригер)","литоландкригер":"Lee Toland Krieger (Ли Толанд Кригер)","lenwiseman":"Len Wiseman (Лен Уайзман)","ленуаизман":"Len Wiseman (Лен Уайзман)","lilianacavani":"Liliana Cavani (Лилиана Кавани)","лилианакавани":"Liliana Cavani (Лилиана Кавани)","louisleterrier":"Louis Leterrier (Луи Летерье)","луилетерье":"Louis Leterrier (Луи Летерье)","markneveldine":"Mark Neveldine (Марк Невелдайн)","маркневелдаин":"Mark Neveldine (Марк Невелдайн)","maryharron":"Mary Harron (Мэри Хэррон)","мэрихэррон":"Mary Harron (Мэри Хэррон)","melgibson":"Mel Gibson (Мэл Гибсон)","мэлгибсон":"Mel Gibson (Мэл Гибсон)","morganjfreeman":"Morgan J. Freeman (Морган Дж. Фриман)","морганджфриман":"Morgan J. Freeman (Морган Дж. Фриман)","nickcassavetes":"Nick Cassavetes (Ник Кассаветис)","никкассаветис":"Nick Cassavetes (Ник Кассаветис)","paulverhoeven":"Paul Verhoeven (Пол Верховен)","полверховен":"Paul Verhoeven (Пол Верховен)","peterberg":"Peter Berg (Питер Берг)","питерберг":"Peter Berg (Питер Берг)","peterfarrelly":"Peter Farrelly (Питер Фаррелли)","питерфаррелли":"Peter Farrelly (Питер Фаррелли)","phillord":"Phil Lord (Фил Лорд)","филлорд":"Phil Lord (Фил Лорд)","quentindupieux":"Quentin Dupieux (Квентин Дюпье)","квентиндюпье":"Quentin Dupieux (Квентин Дюпье)","rajkumarhirani":"Rajkumar Hirani (Раджкумар Хирани)","раджкумархирани":"Rajkumar Hirani (Раджкумар Хирани)","reneclement":"René Clément (Рене Клеман)","ренеклеман":"René Clément (Рене Клеман)","ricromanwaugh":"Ric Roman Waugh (Рик Роман Во)","рикроманво":"Ric Roman Waugh (Рик Роман Во)","rogerspottiswoode":"Roger Spottiswoode (Роджер Споттисвуд)","роджерспоттисвуд":"Roger Spottiswoode (Роджер Споттисвуд)","rubenfleischer":"Ruben Fleischer (Рубен Фляйшер)","рубенфляишер":"Ruben Fleischer (Рубен Фляйшер)","sergeymokritskiy":"Sergey Mokritskiy (Сергей Мокрицкий)","сергеимокрицкии":"Sergey Mokritskiy (Сергей Мокрицкий)","simoncellanjones":"Simon Cellan Jones (Саймон Селлан Джонс)","саимонселланджонс":"Simon Cellan Jones (Саймон Селлан Джонс)","stevensoderbergh":"Steven Soderbergh (Стивен Содерберг)","стивенсодерберг":"Steven Soderbergh (Стивен Содерберг)","sungheejo":"Sung-hee Jo (Чо Сон-хи)","чосонхи":"Sung-hee Jo (Чо Сон-хи)"}};
const KINO_PERSON_CANONICAL_OVERRIDES = {
    Актеры: {
        vitaliygogunskiy: "Vitaly Gogunsky (Виталий Гогунский)",
        vitalygogunsky: "Vitaly Gogunsky (Виталий Гогунский)",
        виталийгогунский: "Vitaly Gogunsky (Виталий Гогунский)",
        виталиигогунскии: "Vitaly Gogunsky (Виталий Гогунский)",
        evgeniyromantsov: "Evgeniy Romantsov (Евгений Романцов)",
        евгенийроманцов: "Evgeniy Romantsov (Евгений Романцов)",
        joeystarr: "JoeyStarr (Джои Старр)",
        джоистарр: "JoeyStarr (Джои Старр)",
        icecube: "Ice Cube (Айс Кьюб)",
        айскьюб: "Ice Cube (Айс Кьюб)",
        methodman: "Method Man (Метод Мэн)",
        методмэн: "Method Man (Метод Мэн)",
        vingrhames: "Ving Rhames (Винг Реймз)",
        вингреймз: "Ving Rhames (Винг Реймз)"
    },
    Режисер: {
        thomasschnauz: "Thomas Schnauz (Томас Шнауц)",
        томасшнауц: "Thomas Schnauz (Томас Шнауц)",
        petergould: "Peter Gould (Питер Гулд)",
        питергулд: "Peter Gould (Питер Гулд)",
        michaelmorris: "Michael Morris (Майкл Моррис)",
        маиклморрис: "Michael Morris (Майкл Моррис)",
        майклморрис: "Michael Morris (Майкл Моррис)",
        adambernstein: "Adam Bernstein (Адам Бернштейн)",
        адамбернштеин: "Adam Bernstein (Адам Бернштейн)",
        mikhailshulaev: "Mikhail Shulaev (Михаил Шулаев)",
        михаилшулаев: "Mikhail Shulaev (Михаил Шулаев)"
    }
};
function roleValueParts(value) {
    const text = String(value ?? "").trim().normalize("NFC")
        .replace(/^\[\[([\s\S]+?)\]\]$/, "$1");
    const match = text.match(/^(.+)\s+-\s+(.+)$/);
    return match
        ? { role: match[1].trim(), name: match[2].trim() }
        : { role: "", name: text };
}
function kinoPersonRole(value) {
    return roleValueParts(value).role;
}
function kinoPersonName(value) {
    return roleValueParts(value).name;
}
function kinoPersonBaseKey(value) {
    let text = kinoPersonName(value);
    text = text.replace(/\s*\([^()]*\)\s*$/, "");
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
}
function normalizeKinoPersonDisplay(value) {
    const role = kinoPersonRole(value);
    let text = kinoPersonName(value);
    for (let i = 0; i < 5; i++) {
        const match = text.match(/^(.+?)\s*\((.*)\)$/);
        if (!match || !match[2].includes("(")) break;
        const inner = match[2].replace(/^.*\(([^()]*)\)$/, "$1").trim();
        if (!inner || inner === match[2]) break;
        text = `${match[1].trim()} (${inner})`;
    }
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    const normalized = pair && kinoPersonBaseKey(pair[1]) === kinoPersonBaseKey(pair[2])
        ? pair[1].trim() : text;
    return role && normalized ? `${role} - ${normalized}` : normalized;
}
function kinoPersonKey(value) {
    return kinoPersonBaseKey(normalizeKinoPersonDisplay(value));
}
function kinoPersonDisplay(field, value) {
    // Источник уже выбрал написание имени. Не добавляем перевод, алиас,
    // транслитерацию или второй вариант имени поверх его значения.
    return String(value ?? "").trim().normalize("NFC");
}
const ENTITY_LINKS_BLOCK = "<!-- KINO:ENTITY:LINKS:V2 -->\n```dataviewjs\nconst KINO_GENRE_ALIASES = {\"Боевик\":[\"Action\",\"Боевик\"],\"Приключения\":[\"Adventure\",\"Приключения\"],\"Анимация\":[\"Animation\",\"Анимация\",\"Мультфильм\"],\"Биография\":[\"Biography\",\"Биография\"],\"Комедия\":[\"Comedy\",\"Комедия\"],\"Криминал\":[\"Crime\",\"Криминал\"],\"Документальный\":[\"Documentary\",\"Документальный\",\"Документальное\"],\"Драма\":[\"Drama\",\"Драма\"],\"Семейный\":[\"Family\",\"Семейный\"],\"Фэнтези\":[\"Fantasy\",\"Фэнтези\"],\"История\":[\"History\",\"История\"],\"Ужасы\":[\"Horror\",\"Ужасы\"],\"Музыка\":[\"Music\",\"Музыка\"],\"Мюзикл\":[\"Musical\",\"Мюзикл\"],\"Мистика\":[\"Mystery\",\"Мистика\"],\"Мелодрама\":[\"Romance\",\"Мелодрама\"],\"Фантастика\":[\"Sci-Fi\",\"Science Fiction\",\"Фантастика\"],\"Короткометражка\":[\"Short\",\"Short Film\",\"Короткометражка\"],\"Спорт\":[\"Sport\",\"Sports\",\"Спорт\"],\"Триллер\":[\"Thriller\",\"Триллер\"],\"Военный\":[\"War\",\"Военный\"],\"Реалити-шоу\":[\"Reality-TV\",\"Reality TV\",\"Реалити-шоу\"],\"Вестерн\":[\"Western\",\"Вестерн\"]};\nconst KINO_ENTITY_FIELDS = [\n    [\"Режисер\", \"Режиссер\", \"Кино - Открыть режиссера\"],\n    [\"Актеры\", \"Актеры\", \"Кино - Открыть актера\"],\n    [\"Жанр\", \"Жанры\", \"Кино - Открыть жанр\"]\n];\n\nfunction kinoEntityText(value) {\n    return String(value ?? \"\").trim().normalize(\"NFC\");\n}\n\nfunction kinoPersonName(value) {\n    return kinoEntityText(value).replace(/\\s+-\\s+.+$/, \"\").trim();\n}\n\nfunction kinoEntityKey(value) {\n    return kinoEntityText(value).toLocaleLowerCase(\"ru\").replace(/ё/g, \"е\");\n}\n\nfunction kinoCanonicalGenre(value) {\n    const text = kinoEntityText(value);\n    const key = kinoEntityKey(text);\n    for (const [canonical, aliases] of Object.entries(KINO_GENRE_ALIASES)) {\n        if ([canonical, ...aliases].some(alias => kinoEntityKey(alias) === key)) return canonical;\n    }\n    return text;\n}\n\nfunction kinoValues(value) {\n    return [...new Set((Array.isArray(value) ? value : [value])\n        .map(kinoEntityText).filter(Boolean))];\n}\n\nfunction kinoCanonical(field, value) {\n    return field === \"Жанр\" ? kinoCanonicalGenre(value) : kinoEntityText(value);\n}\n\nfunction kinoUri(choice, value) {\n    return \"obsidian://quickadd?vault=\" + encodeURIComponent(app.vault.getName())\n        + \"&choice=\" + encodeURIComponent(choice)\n        + \"&value-entity=\" + encodeURIComponent(value);\n}\n\nconst kinoRoot = dv.container.createDiv({ cls: \"kino-entity-links\" });\nfor (const [field, label, choice] of KINO_ENTITY_FIELDS) {\n    const groups = new Map();\n    for (const original of kinoValues(dv.current()[field])) {\n        const canonical = kinoCanonical(field, original);\n        const key = kinoEntityKey(canonical);\n        if (!groups.has(key)) groups.set(key, { label: canonical, originals: [] });\n        groups.get(key).originals.push(original);\n    }\n    const row = kinoRoot.createDiv({ cls: \"kino-entity-links-row\" });\n    row.createEl(\"strong\", { text: label + \": \" });\n    if (!groups.size) {\n        row.appendText(\"Не указано\");\n        continue;\n    }\n    [...groups.values()].forEach((group, index) => {\n        if (field !== \"Актеры\" && index) row.appendText(\" · \");\n        const target = field === \"Актеры\" ? kinoPersonName(group.label) : group.label;\n        const linkRow = field === \"Актеры\" ? row.createDiv({ cls: \"kino-entity-link-line\" }) : row;\n        const link = linkRow.createEl(\"a\");\n        link.textContent = group.label;\n        link.href = kinoUri(choice, target);\n        if (group.originals.some(original => original !== group.label)) {\n            link.title = \"В YAML: \" + group.originals.join(\" / \");\n        }\n    });\n}\n```";
// Новая версия блока читает роли из отдельного YAML-поля. Поле "Актеры"
// остается чистым списком имен и поэтому продолжает работать как индекс.
const ROLE_LINKS_BLOCK = [
    '<!-- KINO:ENTITY:LINKS:V3 -->',
    '```dataviewjs',
    'const KINO_ENTITY_FIELDS = [',
    '    ["Режисер", "Режиссер", "Кино - Открыть режиссера"],',
    '    ["Актеры", "Актеры", "Кино - Открыть актера"],',
    '    ["Жанр", "Жанры", "Кино - Открыть жанр"]',
    '];',
    '',
    'function kinoText(value) { return String(value ?? "").trim().normalize("NFC"); }',
    'function kinoValues(value) {',
    '    return [...new Set((Array.isArray(value) ? value : [value]).map(kinoText).filter(Boolean))];',
    '}',
    'function kinoName(value) {',
    '    const text = kinoText(value);',
    '    const actorNames = kinoValues(dv.current()["Актеры"]);',
    '    const known = actorNames.find(name =>',
    '        text === name || text.startsWith(name + " - ") || text.endsWith(" - " + name)',
    '    );',
    '    if (known) return known;',
    '    return text.includes(" - ") ? text.split(/\\s+-\\s+/).slice(-1)[0].trim() : text;',
    '}',
    'function kinoKey(value) { return kinoText(value).toLocaleLowerCase("ru").replace(/ё/g, "е"); }',
    'function kinoUri(choice, value) {',
    '    return "obsidian://quickadd?vault=" + encodeURIComponent(app.vault.getName())',
    '        + "&choice=" + encodeURIComponent(choice)',
    '        + "&value-entity=" + encodeURIComponent(value);',
    '}',
    '',
    'const actorRoles = kinoValues(dv.current()["Роли актеров"]);',
    'const root = dv.container.createDiv({ cls: "kino-entity-links" });',
    'for (const [field, label, choice] of KINO_ENTITY_FIELDS) {',
    '    const row = root.createDiv({ cls: "kino-entity-links-row" });',
    '    row.createEl("strong", { text: label + ": " });',
    '    const values = field === "Актеры"',
    '        ? (actorRoles.length ? actorRoles : kinoValues(dv.current()[field]))',
    '        : kinoValues(dv.current()[field]);',
    '    if (!values.length) { row.appendText("Не указано"); continue; }',
    '    if (field === "Актеры") {',
    '        values.forEach(value => {',
    '            const line = row.createDiv({ cls: "kino-entity-link-line" });',
    '            const link = line.createEl("a");',
    '            link.textContent = value;',
    '            link.href = kinoUri(choice, kinoName(value));',
    '        });',
    '        continue;',
    '    }',
    '    values.forEach((value, index) => {',
    '        if (index) row.appendText(" · ");',
    '        const link = row.createEl("a");',
    '        link.textContent = value;',
    '        link.href = kinoUri(choice, value);',
    '    });',
    '}',
    '```'
].join("\n");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cooldown = new Map();
let busy = false;

module.exports = {
    entry: async (params, settings) => {
        if (busy) return;
        busy = true;
        try {
            const ready = await addMovie(params, settings);
            if (!ready) {
                if (typeof params.abort === "function") params.abort();
                else { const error = new Error("Добавление отменено"); error.name = "MacroAbortError"; throw error; }
            }
        }
        finally { busy = false; }
    },
    settings: { name: "Movie Script", author: "Christian B. B. Houmann",
        options: { [API_KEY_OPTION]: { type: "text", defaultValue: "", placeholder: "OMDb API Key" } } }
};

async function addMovie(params, settings) {
    const progress = new params.obsidian.Notice("Кино: запускаю…", 0);
    let handedOff = false;
    try {
        return await addMovieCore(params, settings, progress, () => { handedOff = true; });
    } finally {
        if (!handedOff) progress.hide?.();
    }
}

async function addMovieCore(params, settings, progress, handOff) {
    const { app, quickAddApi: qa, obsidian: ob } = params;
    const status = message => progress?.setMessage?.(`Кино: ${message}`);
    status("проверяю настройки…");
    const key = String(settings?.[API_KEY_OPTION] || "").trim();
    if (!key) { new ob.Notice("Укажи OMDb API Key в настройках скрипта."); return; }
    status("жду IMDb ID, ID КП или название…");
    const query = await qa.inputPrompt(
        "IMDb ID, ссылка КП или название",
        "Лучше всего: tt1234567. Также можно 8690650 или ссылку КП",
        ""
    );
    if (!query?.trim()) return;
    const queryText = query.trim();
    const get = (url, values) => getJson(ob, url, values);
    const omdb = values => get("https://www.omdbapi.com/", { ...values, apikey: key });
    const movieFromImdbOrKinopoisk = async imdbId => {
        status(`сверяю имена с IMDb (${imdbId})…`);
        const fromImdb = await omdb({ i: imdbId, plot: "full" });
        return fromImdb && fromImdb.Response !== "False" && /^tt\d{7,12}$/.test(fromImdb.imdbID || "")
            ? fromImdb
            : movieFromKinopoisk(kp, imdbId);
    };
    let movie;
    let kp = null;
    const inputImdbId = extractImdbId(queryText);
    const inputKpId = extractKinopoiskId(queryText);

    if (inputImdbId) {
        status(`получаю данные IMDb (${inputImdbId})…`);
        movie = await omdb({ i: inputImdbId, plot: "full" });
    }
    else if (inputKpId) {
        status(`загружаю данные Кинопоиска (${inputKpId})…`);
        kp = await kinopoiskById(get, inputKpId, ob);
        if (!kp) { new ob.Notice("Не удалось получить карточку по ID Кинопоиска."); return; }
        const linkedImdb = extractImdbId(kp?.imdb_id);
        if (linkedImdb) {
            status(`КП API дал IMDb ID ${linkedImdb}, объединяю данные…`);
            movie = await movieFromImdbOrKinopoisk(linkedImdb);
        } else {
            status("КП API не дал IMDb ID, жду ввод…");
            const imdbInput = await qa.inputPrompt("IMDb ID", "Формат: tt1234567", "");
            if (imdbInput == null || !extractImdbId(imdbInput)) {
                new ob.Notice("Нужен корректный IMDb ID формата tt1234567."); return;
            }
            movie = await movieFromImdbOrKinopoisk(extractImdbId(imdbInput));
        }
    } else {
        // Для поиска по названию первым источником теперь всегда служит КП API.
        // Это дает русское название, КП ID и обычно связанный IMDb ID без
        // лишнего обращения к менее стабильным поисковым страницам.
        status(`ищу фильм через КП API: "${queryText}"…`);
        kp = await kpApiSearchChoice(ob, qa, queryText);
        if (kp) {
            let linkedImdb = extractImdbId(kp?.imdb_id);
            if (!linkedImdb) {
                // Если КП API не вернул IMDb ID, пробуем OMDb по названию как
                // резерв, а не просим пользователя вводить ID сразу.
                status("КП API не дал IMDb ID, ищу резервную связь через OMDb…");
                const fallback = await omdb({ s: kp?.title_en || queryText });
                const candidates = (fallback?.Search || []).filter(item => {
                    const kpYear = String(kp?.year || "").match(/\d{4}/)?.[0] || "";
                    const itemYear = String(item?.Year || "").match(/\d{4}/)?.[0] || "";
                    return !kpYear || !itemYear || kpYear === itemYear;
                });
                let selected = null;
                if (candidates.length === 1) selected = candidates[0];
                else if (candidates.length > 1) selected = await qa.suggester(
                    candidates.map(x => `${x.Title} (${x.Year}, ${x.Type})`), candidates,
                    "IMDb: выбери соответствие для выбранного фильма КП"
                );
                linkedImdb = extractImdbId(selected?.imdbID);
            }
            if (!linkedImdb) {
                const imdbInput = await qa.inputPrompt("IMDb ID", "КП API не вернул IMDb ID. Формат: tt1234567", "");
                linkedImdb = extractImdbId(imdbInput);
            }
            if (!linkedImdb) { new ob.Notice("Для текущей структуры карточки нужен IMDb ID."); return; }
            status(`КП выбран, дополняю данные по IMDb ${linkedImdb}…`);
            movie = await movieFromImdbOrKinopoisk(linkedImdb);
        } else {
            status(`КП API не нашел фильм, ищу в IMDb по названию "${queryText}"…`);
            const result = await omdb({ s: queryText });
            const items = result?.Search || [];
            if (!items.length) {
                status("IMDb тоже не нашел фильм, жду ID или ссылку КП…");
                const kpId = await askKinopoiskId(qa, "Вставь ссылку или ID Кинопоиска");
                if (kpId === undefined) return;
                if (kpId) kp = await kinopoiskById(get, kpId, ob);
                if (!kp) { new ob.Notice("Не удалось определить фильм через Кинопоиск или IMDb."); return; }
                let linkedImdb = extractImdbId(kp?.imdb_id);
                if (!linkedImdb) {
                    const imdbInput = await qa.inputPrompt("IMDb ID", "КП API не вернул IMDb ID. Формат: tt1234567", "");
                    linkedImdb = extractImdbId(imdbInput);
                }
                if (!linkedImdb) { new ob.Notice("Для текущей структуры карточки нужен IMDb ID."); return; }
                movie = await movieFromImdbOrKinopoisk(linkedImdb);
            } else {
                const selected = await qa.suggester(items.map(x => `${x.Title} (${x.Year}, ${x.Type})`), items);
                if (!selected) return;
                status(`загружаю выбранную карточку IMDb (${selected.imdbID})…`);
                movie = await omdb({ i: selected.imdbID, plot: "full" });
            }
        }
    }
    if (!movie || movie.Response === "False" || !/^tt\d{7,12}$/.test(movie.imdbID || "")) {
        status("IMDb не вернул полную карточку, жду ID или ссылку КП…");
        const kpId = await askKinopoiskId(qa, "IMDb не вернул полную карточку. Вставь ссылку или ID Кинопоиска");
        if (kpId === undefined) return;
        if (!kpId) { new ob.Notice("Проверь IMDb ID или укажи ID Кинопоиска."); return; }
        kp = await kinopoiskById(get, kpId, ob);
        if (!kp) { new ob.Notice("Не удалось получить карточку по ID Кинопоиска."); return; }
        let imdbId = inputImdbId || extractImdbId(queryText) || extractImdbId(kp?.imdb_id);
        if (!imdbId) {
            const imdbInput = await qa.inputPrompt("IMDb ID", "КП API не вернул IMDb ID. Формат: tt1234567", "");
            imdbId = extractImdbId(imdbInput);
        }
        if (!imdbId) { new ob.Notice("Для текущей структуры карточки нужен IMDb ID."); return; }
        movie = await movieFromImdbOrKinopoisk(imdbId);
    }
    if (!["movie", "series"].includes(movie.Type)) {
        new ob.Notice("Выбери фильм или сериал целиком, а не отдельный эпизод."); return;
    }
    status("проверяю, нет ли фильма в кинотеке…");
    const existing = await findMovie(app, ob, movie.imdbID);
    if (existing) { await app.workspace.getLeaf(false).openFile(existing); new ob.Notice("Этот фильм уже есть в кинотеке."); return; }

    // Используем Wikidata и поиск по названию. Связь IMDb-КП не сохраняем.
    status("проверяю связь IMDb с Кинопоиском…");
    const wiki = await wikidata(get, movie.imdbID);
    if (!kp) {
        status("загружаю данные Кинопоиска…");
        kp = await kinopoisk(get, qa, movie, wiki, ob);
    }
    if (kpNeedsManualId(kp)) {
        status("данные Кинопоиска неполные, жду ID или ссылку КП…");
        const manualKpId = await askKinopoiskId(qa, kp
            ? "Данные КП найдены не полностью. Вставь ссылку или ID правильной карточки КП"
            : "КП не найден. Вставь ссылку или ID карточки КП");
        if (manualKpId === undefined) return;
        if (manualKpId) {
            const directKp = await kinopoiskById(get, manualKpId, ob);
            if (directKp) kp = directKp;
            else new ob.Notice("ID КП не найден. Продолжаю с доступными данными.");
        }
    }
    if (kp?.imdb_id && extractImdbId(kp.imdb_id) !== movie.imdbID) {
        new ob.Notice("КП ID относится к другому IMDb ID. Добавление остановлено, чтобы не смешать разные фильмы.", 10000);
        return;
    }
    if (kp?.detailsUnavailable) new ob.Notice(`КП ${kp.kp_id}: дополнительные данные временно недоступны. ID будет сохранён.`, 7000);
    status("собираю русское название и описание…");
    let russianTitle = russian(kp?.title) || russian(wiki.title);
    let description = russian(kp?.description) || russian(kp?.overview_ru) || russian(movie.Plot);
    let descriptionSource = description && kp?.kp_id ? `https://www.kinopoisk.ru/film/${kp.kp_id}/` : "";
    if (!description && wiki.article) {
        description = await wikiDescription(get, wiki.article);
        if (description) descriptionSource = wiki.article;
    }
    if (!russianTitle) {
        const input = await qa.inputPrompt("Название для файла на русском", "Введи русское название", "");
        if (!input?.trim()) return;
        russianTitle = input.trim();
    }
    if (!description) {
        const input = await qa.inputPrompt("Описание на русском", "Вставь описание или оставь пустым", "");
        if (input == null) return;
        description = input.trim();
    }
    const title = safeName(russianTitle);
    if (!title) return;
    status("сопоставляю актеров и режиссера…");
    const franchise = {};
    const yamlNumber = value => number(value) === null ? "null" : String(number(value));
    const linkList = (value, field) => links(value, field).map(x => "\n  - " + JSON.stringify(x)).join("");
    let credits = await loadActorCredits(
        ob, movie.imdbID, kp?.kp_id, movie.Type, status
    );
    const kpHasPeople = Boolean(
        kp?.cast?.actors?.length
        || kp?.cast?.director?.length
        || kp?.cast?.directors?.length
    );
    if ((!credits.imdb.length || !credits.imdbDirectors.length) && !kp?.kp_id && !kpHasPeople) {
        status("IMDb не дал полный список, жду ID Кинопоиска…");
        const manualKpId = await askKinopoiskId(
            qa,
            "IMDb не вернул полный список актёров или режиссера. Вставь ID/ссылку КП"
        );
        if (manualKpId === undefined) return;
        if (manualKpId) {
            const directKp = await kinopoiskById(get, manualKpId, ob);
            if (directKp) {
                if (directKp.imdb_id && extractImdbId(directKp.imdb_id) !== movie.imdbID) {
                    new ob.Notice("КП ID относится к другому IMDb ID. Добавление остановлено.", 10000);
                    return;
                }
                kp = directKp;
                credits = await loadActorCredits(ob, movie.imdbID, kp.kp_id, movie.Type, status);
            } else {
                new ob.Notice("ID КП не найден. Продолжаю с данными IMDb.");
            }
        }
    }
    const actorRoleValuesByActor = mergedPeople([
        credits.imdb,
        credits.kp,
        kp?.cast?.actors
    ], "Актеры");
    const actorRoleValues = actorRoleValuesByActor.slice().sort(compareRoleValues);
    const directorValues = mergedPeople([
        credits.imdbDirectors,
        credits.directors,
        kp?.cast?.director
    ], "Режисер");
    const actorNames = [...new Set(actorRoleValuesByActor.map(value => sourcePersonName(value)).filter(Boolean))]
        .sort(comparePeopleValues);
    const directorNames = [...new Set(directorValues.map(value => sourcePersonName(value)).filter(Boolean))];
    const yamlList = values => (values || []).map(value => "\n  - " + JSON.stringify(value)).join("");
    // Актеры и роли сразу передаются шаблону как однострочные YAML-массивы.
    // patchTemplate ниже повторяет это правило после создания карточки.
    const yamlInlineList = values => " " + yamlArray((values || []).map(value => String(value || "").trim()).filter(Boolean));
    params.variables = {
        ...params.variables, ...movie,
        Released: normalizeRelease(movie.Released),
        Plot: description.replace(/\s+/g," ").trim(),
        Runtime: kinoRuntime(movie, kp),
        Actors: actorNames.join(", "),
        Director: directorNames.join(", "),
        actorLinks: yamlInlineList(actorNames),
        actorRoleLinks: yamlInlineList(actorRoleValues),
        actorRoles: actorRoleValues.join("\n"),
        genreLinks: linkList(movie.Genre, "Жанр"),
        directorLink: yamlList(directorNames),
        fileName: title,
        typeLink: `[[${movie.Type === "movie" ? "Movies" : "Series"}]]`,
        languageLower: clean(movie.Language).toLowerCase(),
        kinopoiskRating: yamlNumber(kp?.rating_kp),
        kinopoiskVotes: yamlNumber(kp?.rating_kp_votes),
        imdbVotesNumber: yamlNumber(movie.imdbVotes),
        kinopoiskId: yamlNumber(kp?.kp_id),
        kinopoiskUrl: kp?.kp_id ? `https://www.kinopoisk.ru/${movie.Type === "series" ? "series" : "film"}/${kp.kp_id}/` : "",
        descriptionSource,
        franchiseLink: franchise.path ? `[[${franchise.path.replace(/\.md$/,"")}]]` : "",
        franchisePart: franchise.part ?? ""
    };
    status("создаю карточку из шаблона…");
    watchTemplate(params, movie, title, description, franchise, progress, kp?.kp_id || "", {
        actorNames,
        actorRoles: actorRoleValues,
        directorNames
    });
    handOff?.();
    return true;
}

function extractImdbId(value) {
    return String(value || "").match(/\btt\d{7,12}\b/i)?.[0].toLowerCase() || "";
}
function extractKinopoiskId(value) {
    const text = String(value || "").trim().replace(/^['"]|['"]$/g, "");
    if (/^\d{1,12}$/.test(text)) return text;
    const match = text.match(/(?:kinopoisk\.ru\/(?:film|series)\/|movie-planner\.ru\/f\/|(?:^|[\s:])(?:kp|кп)\s*[:#]?\s*)(\d{1,12})/i);
    return match?.[1] || "";
}
async function askKinopoiskId(qa, prompt) {
    const input = await qa.inputPrompt(
        "ID Кинопоиска",
        `${prompt}. Пример: 8690650 или https://www.kinopoisk.ru/series/8690650/. Можно оставить пустым`,
        ""
    );
    if (input == null) return undefined;
    return extractKinopoiskId(input);
}
function kpNeedsManualId(kp) {
    if (!extractKinopoiskId(kp?.kp_id)) return true;
    // ID уже известен. Повторный ввод того же ID не исправит сбой API.
    if (kp.detailsUnavailable) return false;
    return !russian(kp.title)
        || !russian(kp.description || kp.overview_ru)
        || number(kp.rating_kp) === null
        || number(kp.rating_kp_votes) === null;
}
function movieFromKinopoisk(kp, imdbId) {
    const actors = Array.isArray(kp?.cast?.actors) ? kp.cast.actors : [];
    const director = kp?.cast?.director;
    let poster = clean(kp?.poster_url);
    if (poster && poster.startsWith("/")) poster = "https://movie-planner.ru" + poster;
    return {
        imdbID: imdbId,
        Title: clean(kp?.title_en) || clean(kp?.title),
        Year: kp?.year ? String(kp.year) : "",
        Type: kp?.is_series ? "series" : "movie",
        Released: clean(kp?.premiere_date),
        Runtime: kinoRuntime({}, kp) || "N/A",
        Genre: clean(kp?.genres),
        Director: sourcePersonValue(director, "Режисер"),
        Actors: actors.map(person => sourcePersonValue(person, "Актеры"))
            .filter(Boolean).join(", "),
        Plot: clean(kp?.overview_en) || clean(kp?.description),
        Language: "Russian",
        Country: clean(kp?.country),
        Poster: poster,
        imdbRating: clean(kp?.rating_imdb),
        imdbVotes: clean(kp?.rating_imdb_votes)
    };
}

function clean(value) { return value && value !== "N/A" ? String(value).trim() : ""; }
function russian(value) { const text = clean(value); return /[а-яё]/i.test(text) ? text : ""; }
function number(value) {
    const text = clean(value).replace(/[,\s]/g, "");
    return text && Number.isFinite(Number(text)) ? Number(text) : null;
}
function cleanRole(value) {
    if (value === null || value === undefined || value === "") return "";
    if (Array.isArray(value)) {
        return [...new Set(value.map(cleanRole).filter(Boolean))].join(" / ");
    }
    if (typeof value === "object") {
        for (const key of ["name_ru", "name", "title_ru", "title", "value", "role_ru", "role_en", "role", "character", "character_name", "characterName"]) {
            const result = cleanRole(value[key]);
            if (result) return result;
        }
        return "";
    }
    const text = clean(value).replace(/^['"]|['"]$/g, "").trim();
    if (!text || /^(actor|actress|актёр|актер|актриса)$/i.test(text)) return "";
    return text;
}

function splitBilingualText(value) {
    const text = htmlPlain(String(value ?? "")).replace(/\s+/g, " ").trim();
    if (!text) return { english: "", russian: "" };
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    if (pair && /[a-z]/i.test(pair[1]) && /[а-яё]/i.test(pair[2])) {
        return { english: pair[1].trim(), russian: pair[2].trim() };
    }
    if (pair && /[а-яё]/i.test(pair[1]) && /[a-z]/i.test(pair[2])) {
        return { english: pair[2].trim(), russian: pair[1].trim() };
    }
    const main = text.replace(/\s+\((?:в титрах|in credits|credited as|credit(?:ed)? as)[\s\S]*$/i, "").trim();
    const russianFirst = main.match(/^(.+?[А-ЯЁа-яё][А-ЯЁа-яё .,'’`-]*)\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .,'’`-]*)$/u);
    if (russianFirst) return { english: russianFirst[2].trim(), russian: russianFirst[1].trim() };
    const englishFirst = main.match(/^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .,'’`-]*)\s+(.+?[А-ЯЁа-яё][А-ЯЁа-яё .,'’`-]*)$/u);
    if (englishFirst) return { english: englishFirst[1].trim(), russian: englishFirst[2].trim() };
    return {
        english: /[a-z]/i.test(text) && !/[а-яё]/i.test(text) ? text : "",
        russian: /[а-яё]/i.test(text) ? text : ""
    };
}

function transliterateEnglishToRussian(value) {
    const digraphs = [["tch", "ч"], ["sch", "ш"], ["sh", "ш"], ["ch", "ч"], ["th", "т"],
        ["ph", "ф"], ["kh", "х"], ["zh", "ж"], ["ts", "ц"], ["qu", "кв"], ["ck", "к"],
        ["ya", "я"], ["yu", "ю"], ["yo", "ё"], ["ee", "и"], ["oo", "у"], ["ou", "ау"], ["ow", "оу"]];
    const chars = { a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и",
        j: "дж", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с",
        t: "т", u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з" };
    const source = String(value || "").toLocaleLowerCase("en");
    let result = "";
    for (let index = 0; index < source.length;) {
        const rest = source.slice(index);
        const digraph = digraphs.find(([from]) => rest.startsWith(from));
        if (digraph) { result += digraph[1]; index += digraph[0].length; continue; }
        result += chars[source[index]] ?? source[index];
        index++;
    }
    return result.replace(/ие(?=\s|[\/,;:.)]|$)/g, "и")
        .replace(/(^|[\s-])([а-яё])/g, (_, prefix, char) => prefix + char.toLocaleUpperCase("ru"));
}

function roleRussianFromEnglish(value) {
    const text = cleanRole(value);
    if (!text || /[а-яё]/i.test(text) && !/[a-z]/i.test(text)) return text;
    const exact = {
        cathy: "Кэти",
        lewis: "Льюис",
        dennis: "Деннис",
        jen: "Джен",
        jarrod: "Джаррод"
    }[text.toLocaleLowerCase("en")];
    if (exact) return exact;
    const phrases = [
        ["scenes deleted", "сцены вырезаны"], ["uncredited", "в титрах не указан"],
        ["himself", "самого себя"], ["herself", "саму себя"], ["themselves", "самих себя"],
        ["voice", "голос"], ["narrator", "рассказчик"], ["waitress", "официантка"],
        ["waiter", "официант"], ["attorney", "адвокат"], ["prosecutor", "прокурор"],
        ["ranger", "рейнджер"], ["doctor", "доктор"], ["professor", "профессор"],
        ["detective", "детектив"], ["police officer", "полицейский"], ["customer", "посетитель"],
        ["woman", "женщина"], ["man", "мужчина"], ["girl", "девушка"], ["boy", "мальчик"],
        ["mother", "мать"], ["father", "отец"], ["wife", "жена"], ["husband", "муж"],
        ["brother", "брат"], ["sister", "сестра"], ["young", "молодой"], ["old", "старый"]
    ];
    const placeholders = [];
    let translated = text;
    for (const [english, russian] of phrases) {
        const token = `\uE000${placeholders.length}\uE001`;
        const expression = new RegExp(`(^|[^A-Za-z])${english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "gi");
        if (expression.test(translated)) {
            translated = translated.replace(expression, (_, prefix) => prefix + token);
            placeholders.push(russian);
        }
    }
    translated = translated.split(/([A-Za-zÀ-ÖØ-öø-ÿ]+)/u).map(part =>
        /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(part) ? transliterateEnglishToRussian(part) : part
    ).join("");
    return translated.replace(/\uE000(\d+)\uE001/g, (_, index) => placeholders[Number(index)] || "");
}

function roleParts(value) {
    if (value && typeof value === "object" && (value.role_en || value.role_ru || value.character_en || value.character_ru)) {
        const english = cleanRole(value.role_en || value.character_en || "");
        const russian = cleanRole(value.role_ru || value.character_ru || "");
        return { english, russian: russian || roleRussianFromEnglish(english) };
    }
    const raw = typeof value === "string"
        ? roleValueParts(value).role || value
        : ["role", "character", "character_name", "characterName", "role_name", "roleName",
            "characters", "roles", "played_as", "playedAs"].map(key => cleanRole(value?.[key])).find(Boolean) || "";
    const pair = splitBilingualText(raw);
    const english = pair.english || (/[a-z]/i.test(raw) && !/[а-яё]/i.test(raw) ? cleanRole(raw) : "");
    const russian = pair.russian || (/[а-яё]/i.test(raw) && !/[a-z]/i.test(raw) ? cleanRole(raw) : "")
        || roleRussianFromEnglish(english);
    return { english, russian };
}

function formatRole(value) {
    const parts = roleParts(value);
    return parts.english && parts.russian
        ? `${parts.english} (${parts.russian})`
        : parts.english || parts.russian || "";
}

function personRole(person) {
    if (typeof person === "string" && !/\s+-\s+/.test(person)) return "";
    return formatRole(person);
}
function personParts(value) {
    const text = normalizeKinoPersonDisplay(kinoPersonName(clean(value)));
    if (!text || text.toUpperCase() === "N/A") return { english: "", russian: "" };
    const pair = text.match(/^(.+?)\s*\(([^()]*)\)$/);
    const bilingual = pair ? { english: "", russian: "" } : splitBilingualText(text);
    const values = pair ? [pair[1].trim(), pair[2].trim()] : [bilingual.english, bilingual.russian].filter(Boolean);
    return {
        english: values.find(part => /[a-z]/i.test(part) && !/[а-яё]/i.test(part)) || "",
        russian: values.find(part => /[а-яё]/i.test(part)) || ""
    };
}
function personEnglishName(person) {
    const values = [
        typeof person === "string" ? person : "",
        person?.name_en, person?.english_name, person?.name,
        person?.name_ru, person?.original_name
    ].map(clean).filter(Boolean);
    for (const value of values) {
        const parts = personParts(value);
        if (parts.english) return parts.english;
    }
    return "";
}
function personRussianName(person) {
    const values = [
        typeof person === "string" ? person : "",
        person?.name_ru, person?.russian_name, person?.name,
        person?.name_en, person?.original_name
    ].map(clean).filter(Boolean);
    for (const value of values) {
        const parts = personParts(value);
        if (parts.russian) return parts.russian;
    }
    return "";
}
function transliterateRussian(value) {
    const map = {
        а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo", ж:"zh", з:"z", и:"i", й:"y",
        к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f",
        х:"kh", ц:"ts", ч:"ch", ш:"sh", щ:"shch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya",
        і:"i", ї:"yi", є:"ye", ґ:"g", ў:"u", ђ:"dj", ј:"j", љ:"lj", њ:"nj", ћ:"c", џ:"dz", ѕ:"dz", ѓ:"gj", ќ:"kj",
        ә:"a", ғ:"gh", қ:"q", ң:"ng", ө:"o", ұ:"u", ү:"u", һ:"h", ӓ:"a", ӧ:"o", ӱ:"u", ӂ:"zh"
    };
    return String(value || "").toLocaleLowerCase("ru").split("").map(char => map[char] ?? char).join("");
}
function titleCaseTransliteration(value) {
    return transliterateRussian(value).replace(/(^|[\s.-])([a-z])/gi, (_, separator, letter) => separator + letter.toUpperCase());
}
function transliteratePersonName(value) {
    const result = String(value || "").split(/(\p{Script=Cyrillic}+)/u).map(part => {
        if (!/\p{Script=Cyrillic}/u.test(part)) return part;
        const latin = transliterateRussian(part);
        return /^\p{Lu}/u.test(part)
            ? latin.charAt(0).toUpperCase() + latin.slice(1)
            : latin;
    }).join("").replace(/\s+/g, " ").trim();
    return /\p{Script=Cyrillic}/u.test(result) ? "" : result;
}
function personMatchKeys(value) {
    const parts = personParts(value);
    const candidates = [clean(value), parts.english, parts.russian].filter(Boolean);
    const keys = new Set();
    for (const candidate of candidates) {
        const plain = candidate.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ru");
        const transliterated = transliterateRussian(candidate);
        for (const key of [
            plain.replace(/[^0-9a-zа-яё]/gi, "").replace(/ё/g, "е"),
            transliterated.replace(/[^0-9a-z]/gi, ""),
            normalizePersonMatchKey(plain),
            normalizePersonMatchKey(transliterated)
        ]) if (key) keys.add(key);
    }
    return keys;
}
function samePerson(left, right) {
    const rightKeys = personMatchKeys(right);
    return [...personMatchKeys(left)].some(key => rightKeys.has(key));
}
function normalizePersonMatchKey(value) {
    return String(value || "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("en")
        .replace(/[^0-9a-z]/gi, "")
        // Распространённые варианты латинской передачи русских окончаний:
        // Gogunskiy/Gogunsky, Vitaliy/Vitaly, -ii/-iy/-y.
        .replace(/iy/g, "y")
        .replace(/ii/g, "y");
}
function personPair(english, russian, field, role = "") {
    const rawValues = [clean(english), clean(russian)].filter(Boolean);
    const normalizedRole = formatRole(role) || personRole(english) || personRole(russian);
    const normalizedValues = rawValues.map(value => kinoPersonDisplay(field, value));
    // Сначала берём канонический вариант: так Vitaliy Gogunskiy не вернётся
    // обратно поверх заданного Vitaly Gogunsky.
    const values = [...normalizedValues, ...rawValues];
    let en = "";
    let ru = "";
    for (const value of values) {
        const parts = personParts(value);
        if (!en && parts.english) en = parts.english;
        if (!ru && parts.russian) ru = parts.russian;
    }
    if (!en && ru) en = titleCaseTransliteration(ru);
    let result = "";
    if (en && ru && en !== ru) result = `${en} (${ru})`;
    else if (en) result = en;
    else if (ru) result = ru;
    else result = rawValues.some(value => value.toUpperCase() === "N/A") ? "N/A" : "";
    return normalizedRole && result && result.toUpperCase() !== "N/A"
        ? `${normalizedRole} - ${result}` : result;
}
function sourcePersonName(person) {
    const candidates = typeof person === "string"
        ? [person]
        : [person?.name_en, person?.english_name, person?.original_name,
            person?.display_name, person?.source_name, person?.name_raw,
            person?.name, person?.name_ru];
    let fallback = "";
    for (const candidate of candidates.map(clean).filter(Boolean)) {
        const text = typeof person === "string" ? roleValueParts(candidate).name : candidate;
        const parts = splitBilingualText(text);
        if (parts.english && !/\p{Script=Cyrillic}/u.test(parts.english)) return parts.english;
        if (!/\p{Script=Cyrillic}/u.test(text)) return text;
        fallback ||= parts.russian || text;
    }
    return transliteratePersonName(fallback);
}

function sourcePersonRole(person, field) {
    if (field !== "Актеры") return "";
    if (typeof person === "string") return clean(roleValueParts(person).role);
    return clean(person?.role_raw || person?.source_role || person?.role
        || person?.character || person?.character_name || person?.characterName
        || person?.role_en || person?.role_ru || "");
}

function sourcePersonValue(person, field) {
    const name = sourcePersonName(person);
    if (!name || name.toUpperCase() === "N/A") return "";
    const role = sourcePersonRole(person, field);
    return role ? `${role} - ${name}` : name;
}

function mergedPeople(peopleSources, field) {
    const sources = (Array.isArray(peopleSources) ? peopleSources : [peopleSources])
        .filter(source => Array.isArray(source) && source.length);
    if (!sources.length) return [];

    // Порядок источников задается вызывающим кодом: IMDb, затем КП. Если
    // IMDb вернул имена, но не роли, для актёров используем первый резервный
    // источник с ролями.
    const selected = field === "Актеры"
        ? sources.find(source => source.some(person => sourcePersonRole(person, field))) || sources[0]
        : sources[0];
    const result = [];
    const seen = new Set();
    for (const person of selected) {
        const value = sourcePersonValue(person, field);
        const key = value.normalize("NFC").replace(/\s+/g, " ").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(key);
    }
    return result.sort(comparePeopleValues);
}

function comparePeopleValues(left, right) {
    const leftName = sourcePersonName(left);
    const rightName = sourcePersonName(right);
    return leftName.localeCompare(rightName, "en", { sensitivity: "base", numeric: true })
        || String(left).localeCompare(String(right), "en", { sensitivity: "base", numeric: true });
}

function compareRoleValues(left, right) {
    const leftRole = sourcePersonRole(left, "Актеры");
    const rightRole = sourcePersonRole(right, "Актеры");
    return leftRole.localeCompare(rightRole, "en", { sensitivity: "base", numeric: true })
        || sourcePersonName(left).localeCompare(sourcePersonName(right), "en", { sensitivity: "base", numeric: true });
}
function kinoRuntime(movie, kp) {
    const original = clean(movie?.Runtime);
    if (original) return original;
    const duration = number(kp?.duration_min ?? kp?.runtime_min ?? kp?.episode_runtime_min);
    return duration === null ? "" : `${duration} min`;
}
function links(value, field) {
    const values = Array.isArray(value) ? value : clean(value).split(",");
    return [...new Set(values.map(x => field === "Актеры"
        ? sourcePersonName(x)
        : kinoPersonDisplay(field, entityName(x))).filter(Boolean))];
}
function safeName(value) {
    let name = clean(value).replace(/[\\/:*?"<>|\[\]#^\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/g, "").slice(0, 160).trim();
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = "_" + name;
    return name;
}
function normalized(value) { return clean(value).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, ""); }
async function frontmatter(app, ob, file) {
    const raw = await app.vault.read(file);
    const match = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    try { return match ? ob.parseYaml(match[1]) || {} : {}; } catch { return {}; }
}
async function findMovie(app, ob, id) {
    for (const file of app.vault.getMarkdownFiles()) {
        if (!file.path.startsWith(ROOT + "/") || /\/((Просмотры|Сезоны|Франшизы|Служебное))\//.test(file.path)) continue;
        const fm = await frontmatter(app, ob, file);
        if (String(fm["imdb Id"] || "").trim().toLowerCase() === id) return file;
    }
    return null;
}
function availablePath(app, title, year, id) {
    const occupied = new Set(app.vault.getMarkdownFiles().map(f => f.path.toLowerCase()));
    for (const suffix of ["", ` (${safeName(year)})`, ` (${id})`]) {
        const path = `${ROOT}/${title}${suffix}.md`;
        if (!occupied.has(path.toLowerCase()) && !app.vault.getAbstractFileByPath(path)) return path;
    }
    for (let i = 2; ; i++) {
        const path = `${ROOT}/${title} (${id}, ${i}).md`;
        if (!occupied.has(path.toLowerCase()) && !app.vault.getAbstractFileByPath(path)) return path;
    }
}
async function ensureFolder(app, folder) {
    let path = "";
    for (const name of folder.split("/")) {
        path = path ? path + "/" + name : name;
        if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
    }
}
async function askRating(qa) {
    while (true) {
        const value = await qa.inputPrompt("Моя оценка", "От 1 до 10; пусто - без оценки");
        if (value == null) return undefined;
        if (!value.trim()) return null;
        const n = Number(value.replace(",", "."));
        if (Number.isFinite(n) && n >= 1 && n <= 10) return n;
    }
}
async function askDate(qa) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    while (true) {
        const value = await qa.inputPrompt("Дата просмотра", "ГГГГ-ММ-ДД или ДД.ММ.ГГГГ; пусто - еще не смотрел", today);
        if (value == null) return undefined;
        if (!value.trim()) return "";
        const text = value.trim().replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, "$3-$2-$1");
        const date = new Date(text + "T12:00:00Z");
        if (/^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(date.getTime()) && date.toISOString().startsWith(text)) return text;
    }
}

async function getJson(ob, base, params = {}) {
    const url = new URL(base);
    Object.entries(params).forEach(([key,value]) => url.searchParams.set(key,String(value)));
    const host = url.host;
    if ((cooldown.get(host) || 0) - Date.now() > 15000) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, (cooldown.get(host) || 0) - Date.now()));
        cooldown.set(host, Date.now() + 1200);
        let timer;
        try {
            const response = await Promise.race([
                ob.requestUrl({ url: url.href, method: "GET", throw: false,
                    headers: { Accept: "application/json", "User-Agent": "ObsidianKinoteka/2.0 (personal movie catalogue)" } }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 15000); })
            ]);
            if ([429,503].includes(response.status)) {
                const header = Object.entries(response.headers || {}).find(([k]) => k.toLowerCase() === "retry-after")?.[1];
                const pause = !header ? 5000 : Number.isFinite(Number(header)) ? Math.max(1000,Number(header)*1000) : Math.max(1000,Date.parse(header)-Date.now()) || 5000;
                cooldown.set(host,Date.now()+pause);
                if (attempt === 0 && pause <= 15000) continue;
                return null;
            }
            if (response.status !== 200) return null;
            const data = response.json;
            if (data?.Response === "False" || data?.error) return null;
            return data;
        } catch { cooldown.set(host,Date.now()+2500); return null; }
        finally { clearTimeout(timer); }
    }
    return null;
}

async function kpApiJson(ob, path, params = {}) {
    const url = new URL(KP_API_BASE + path);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });
    const hostKey = "kp-api:" + url.host;
    for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, (cooldown.get(hostKey) || 0) - Date.now()));
        cooldown.set(hostKey, Date.now() + 280);
        let timer;
        try {
            const response = await Promise.race([
                ob.requestUrl({
                    url: url.href, method: "GET", throw: false,
                    headers: { Accept: "application/json", "X-API-KEY": KP_API_KEY }
                }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 15000); })
            ]);
            if ([429, 503].includes(response.status)) {
                cooldown.set(hostKey, Date.now() + 2500);
                if (attempt === 0) continue;
                return null;
            }
            if (response.status !== 200) return null;
            return response.json || null;
        } catch {
            cooldown.set(hostKey, Date.now() + 1500);
            if (attempt === 0) continue;
            return null;
        } finally { clearTimeout(timer); }
    }
    return null;
}

function kpApiFilmLegacy(film) {
    if (!film?.kinopoiskId) return null;
    const premiere = film.premiereRu || film.premiereWorld || film.premiereDigital || "";
    return {
        kp_id: String(film.kinopoiskId),
        imdb_id: String(film.imdbId || ""),
        title: film.nameRu || film.nameOriginal || film.nameEn || "",
        title_en: film.nameOriginal || film.nameEn || film.nameRu || "",
        description: film.description || film.shortDescription || "",
        overview_ru: film.description || film.shortDescription || "",
        overview_en: "",
        year: film.year || "",
        is_series: Boolean(film.serial || film.type === "TV_SERIES" || film.type === "MINI_SERIES" || film.type === "TV_SHOW"),
        premiere_date: premiere,
        rating_kp: film.ratingKinopoisk,
        rating_kp_votes: film.ratingKinopoiskVoteCount,
        rating_imdb: film.ratingImdb,
        rating_imdb_votes: film.ratingImdbVoteCount,
        poster_url: film.posterUrl || film.posterUrlPreview || "",
        genres: (film.genres || []).map(x => x.genre).filter(Boolean).join(", "),
        country: (film.countries || []).map(x => x.country).filter(Boolean).join(", "),
        film_length: film.filmLength || "",
        cast: {},
        source: "kinopoisk-api"
    };
}

async function kpApiSearchChoice(ob, qa, query) {
    const found = await kpApiJson(ob, "/v2.1/films/search-by-keyword", { keyword: query, page: 1 });
    const items = (found?.films || []).slice(0, 20);
    if (!items.length) return null;
    const selected = await qa.suggester(
        items.map(x => `${x.nameRu || x.nameEn || "Без названия"} (${x.year || "?"}) - КП ${x.filmId}`),
        items,
        `Кинопоиск: выбери фильм для "${query}"`
    );
    if (!selected) return null;
    return await kinopoiskById((url, values) => getJson(ob, url, values), selected.filmId, ob);
}

function kpApiStaffCredits(items) {
    const actors = [], directors = [];
    for (const person of Array.isArray(items) ? items : []) {
        const profession = String(person.professionKey || "").toUpperCase();
        const rawName = String(person.nameEn || person.nameRu || "").trim();
        const name = /[A-Za-z]/.test(rawName) ? rawName : transliteratePersonName(rawName);
        if (!name) continue;
        const credit = {
            name, name_en: name, name_ru: String(person.nameRu || "").trim(),
            display_name: name,
            role: String(person.description || "").trim(),
            role_en: String(person.description || "").trim(), role_ru: ""
        };
        if (profession === "DIRECTOR") directors.push(credit);
        else if (["ACTOR", "VOICE_MALE", "VOICE_FEMALE", "HIMSELF", "HERSELF"].includes(profession)) actors.push(credit);
    }
    return { actors: uniqueRoleCredits(actors), directors: uniquePeople(directors) };
}

async function getText(ob, url, headers = {}) {
    const parsed = new URL(url);
    const host = parsed.host;
    if ((cooldown.get(host) || 0) - Date.now() > 15000) return "";
    for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, (cooldown.get(host) || 0) - Date.now()));
        cooldown.set(host, Date.now() + 1200);
        let timer;
        try {
            const response = await Promise.race([
                ob.requestUrl({
                    url,
                    method: "GET",
                    throw: false,
                    headers: {
                        Accept: "text/html,application/xhtml+xml",
                        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                        ...headers
                    }
                }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 20000); })
            ]);
            if ([429, 503].includes(response.status)) {
                cooldown.set(host, Date.now() + 5000);
                if (attempt === 0) continue;
                return "";
            }
            if (response.status !== 200) return "";
            return String(response.text || "");
        } catch {
            cooldown.set(host, Date.now() + 2500);
        } finally {
            clearTimeout(timer);
        }
    }
    return "";
}

async function postJson(ob, url, body, headers = {}) {
    const parsed = new URL(url);
    const host = parsed.host;
    if ((cooldown.get(host) || 0) - Date.now() > 15000) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(Math.max(0, (cooldown.get(host) || 0) - Date.now()));
        cooldown.set(host, Date.now() + 1200);
        let timer;
        try {
            const response = await Promise.race([
                ob.requestUrl({
                    url,
                    method: "POST",
                    throw: false,
                    body: JSON.stringify(body),
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
                        Origin: "https://www.imdb.com",
                        Referer: "https://www.imdb.com/",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                        ...headers
                    }
                }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 20000); })
            ]);
            if ([429, 503].includes(response.status)) {
                cooldown.set(host, Date.now() + 5000);
                if (attempt === 0) continue;
                return null;
            }
            if (response.status !== 200) return null;
            if (response.json && typeof response.json === "object") return response.json;
            return JSON.parse(String(response.text || "{}"));
        } catch {
            cooldown.set(host, Date.now() + 2500);
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

function decodeHtml(value) {
    return String(value ?? "")
        .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
            const number = code[0].toLowerCase() === "x"
                ? parseInt(code.slice(1), 16) : parseInt(code, 10);
            return Number.isFinite(number) ? String.fromCodePoint(number) : _;
        })
        .replace(/&nbsp;/gi, " ")
        .replace(/&quot;/gi, '"')
        .replace(/&apos;|&#39;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">");
}

function htmlPlain(value) {
    return decodeHtml(String(value ?? "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(?:div|p|li|tr|section|article|h[1-6]|dd|dt)>/gi, "\n")
        .replace(/<[^>]+>/g, " "))
        .replace(/[ \t]+/g, " ")
        .replace(/\n[ \t]+/g, "\n")
        .trim();
}

function valueText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(" / ");
    if (typeof value === "object") {
        for (const key of ["text", "value", "name", "displayName", "label", "title"]) {
            const text = valueText(value[key]);
            if (text) return text;
        }
    }
    return "";
}

function creditRoleText(value) {
    const text = valueText(value).replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
    const cleaned = text.replace(/^(?:as|в роли)\s+/i, "").replace(/\s*,\s*\$[\d\s.,]+.*$/i, "").replace(/\s+\d+\.\s*$/, "").trim();
    if (!cleaned || /^(actor|actress|cast|act[её]р|актриса)$/i.test(cleaned)) return "";
    if (/^(режиссёр|режиссер|director|producer|продюсер|writer|сценарист|оператор|cinematographer|монтажёр|монтажер|editor)$/i.test(cleaned)
        || /(?:режисс[её]р|продюсер|сценарист|оператор|монтаж[её]р|художник|композитор|костюм|грим|director|producer|writer|cinematographer|editor)/i.test(cleaned)) return "";
    return cleaned;
}

function creditNameParts(node, source) {
    const values = [];
    const separated = { english: "", russian: "" };
    const add = value => {
        const text = valueText(value);
        if (text && !values.includes(text)) values.push(text);
        const pair = splitBilingualText(text);
        if (!separated.english && pair.english) separated.english = pair.english;
        if (!separated.russian && pair.russian) separated.russian = pair.russian;
        for (const part of [pair.english, pair.russian]) {
            if (part && !values.includes(part)) values.push(part);
        }
    };
    if (typeof node === "string") add(node);
    else if (node && typeof node === "object") {
        const keys = source === "kp"
            ? ["name_ru", "russian_name", "name", "displayName", "title"]
            : ["name_en", "english_name", "original_name", "name", "displayName", "title"];
        keys.forEach(key => add(node[key]));
        if (node.nameText) add(node.nameText);
        if (node.name && typeof node.name === "object") {
            add(node.name.nameText);
            add(node.name.displayName);
            add(node.name.text);
        }
    }
    const english = separated.english || values.find(value => /[a-z]/i.test(value) && !/[а-яё]/i.test(value)) || "";
    const russian = separated.russian || values.find(value => /[а-яё]/i.test(value) && !/[a-z]/i.test(value)) || "";
    return { english, russian, values, raw: values[0] || "" };
}

function collectJsonCredits(node, source, result = [], seen = new WeakSet()) {
    if (!node || typeof node !== "object") return result;
    if (seen.has(node)) return result;
    seen.add(node);
    if (Array.isArray(node)) {
        node.forEach(item => collectJsonCredits(item, source, result, seen));
        return result;
    }
    const role = creditRoleText(node.characters || node.character || node.role || node.roleName
        || node.character_name || node.characterName || node.roles || node.charactersText);
    const nestedPerson = node.person || node.actor || node.personInfo || node.castMember;
    const directNames = creditNameParts(node, source);
    const nestedNames = creditNameParts(nestedPerson, source);
    const names = {
        english: directNames.english || nestedNames.english,
        russian: directNames.russian || nestedNames.russian
    };
    if (role && (names.english || names.russian) && (node.id || node.nconst || node.href || node.url
        || node.personId || node.kinopoiskId || node.name || node.nameText || nestedPerson)) {
        result.push({ name_en: names.english, name_ru: names.russian,
            display_name: directNames.raw || nestedNames.raw || names.english || names.russian,
            role });
    }
    Object.values(node).forEach(value => collectJsonCredits(value, source, result, seen));
    return result;
}

function parseEmbeddedCredits(html, source) {
    const result = [];
    const scripts = String(html || "").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
    for (const match of scripts) {
        const attrs = match[1] || "";
        const body = match[2].trim();
        if (!/application\/json|__NEXT_DATA__|initial/i.test(attrs + body.slice(0, 80))) continue;
        try {
            const parsed = JSON.parse(body.replace(/^<!--|-->$/g, "").trim());
            collectJsonCredits(parsed, source, result);
        } catch { /* На странице может быть несколько служебных JSON-блоков. */ }
    }
    return result;
}

function roleFromCreditChunk(chunk) {
    const roleElements = /<([a-z0-9]+)\b[^>]*(?:class|data-testid|data-qa)=['"][^'"]*(?:role|character|acting|characters)[^'"]*['"][^>]*>([\s\S]*?)<\/\1>/gi;
    for (const match of String(chunk || "").matchAll(roleElements)) {
        const role = creditRoleText(htmlPlain(match[2]));
        if (role) return role;
    }
    const plain = htmlPlain(chunk);
    const asRole = plain.match(/\bas\s+([^\n|·]{1,120})/i)?.[1];
    if (asRole && creditRoleText(asRole)) return creditRoleText(asRole);
    const ellipsis = plain.match(/(?:\.\.\.|…)[ \t]*([^\n]{1,120})/);
    if (ellipsis && creditRoleText(ellipsis[1])) return creditRoleText(ellipsis[1]);
    return "";
}

function parseAnchorCredits(html, source) {
    const result = [];
    const links = [...String(html || "").matchAll(/<a\b[^>]*href=['"][^'"]*\/name\/(?:nm)?\d+[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi)];
    links.forEach((match, index) => {
        const name = htmlPlain(match[1]);
        const next = links[index + 1]?.index ?? Math.min(String(html).length, (match.index || 0) + 2400);
        const chunk = String(html).slice(match.index || 0, next);
        const role = roleFromCreditChunk(chunk);
        if (!role || !name || name.length > 120) return;
        const names = creditNameParts(name, source);
        const parts = { name_en: names.english, name_ru: names.russian,
            display_name: name };
        result.push({ ...parts, role });
    });
    return result;
}

function kinopoiskSectionBefore(html, index) {
    const plain = htmlPlain(String(html || "").slice(0, index)).replace(/\s+/g, " ").trim();
    const markers = [...plain.matchAll(/(?:^|\s)(Режисс(?:е|ё)р(?:ы)?(?:\s+дубляжа)?|Акт(?:е|ё)ры(?:\s+дубляжа)?|Продюсеры|Сценаристы|Оператор|Композитор|Художники|Монтажер|Монтажёр)(?=\s|$)/gi)];
    const marker = markers.at(-1)?.[1]?.toLocaleLowerCase("ru") || "";
    if (marker.includes("режисс") && !marker.includes("дубляж")) return "director";
    if (marker.includes("актер") || marker.includes("актёр")) {
        return marker.includes("дубляж") ? "" : "actor";
    }
    return "";
}

function kinopoiskNameParts(anchorName, chunk) {
    const anchor = htmlPlain(anchorName).replace(/\s+/g, " ").trim();
    let plain = htmlPlain(chunk).replace(/\s+/g, " ").trim().replace(/^\d+\.\s*/, "");
    plain = plain.split(/\s+(?:\.\.\.|…)[ \t]*/)[0].trim();
    plain = plain.replace(/\s+(?:Акт(?:е|ё)ры|Режисс(?:е|ё)р(?:ы)?|Продюсеры|Сценаристы|Оператор|Композитор|Художники|Монтажер|Монтажёр)(?=\s|$)[\s\S]*$/i, "").trim();
    const names = creditNameParts(plain || anchor, "mixed");
    const anchorParts = creditNameParts(anchor, "mixed");
    return {
        english: names.english || anchorParts.english,
        russian: names.russian || anchorParts.russian,
        display: names.english || names.russian || anchorParts.english || anchorParts.russian || anchor
    };
}

function kinopoiskRoleFromChunk(chunk) {
    const plain = htmlPlain(chunk).replace(/\s+/g, " ").trim();
    const role = roleFromCreditChunk(chunk);
    if (role) return role;
    const after = plain.match(/(?:\.\.\.|…)\s*(.+)$/)?.[1] || "";
    if (!after) return "";
    // После роли на странице КП может сразу идти имя актера дубляжа.
    const withoutDub = after.replace(/\s+(?=[А-ЯЁ][А-ЯЁа-яё]+(?:\s+[А-ЯЁ][А-ЯЁа-яё]+){1,}(?:\s|$)).*$/u, "").trim();
    return creditRoleText(withoutDub || after);
}

function sameCreditPerson(left, right) {
    const leftNames = [left?.name_en, left?.name_ru, personEnglishName(left), personRussianName(left)].filter(Boolean);
    const rightNames = [right?.name_en, right?.name_ru, personEnglishName(right), personRussianName(right)].filter(Boolean);
    return leftNames.some(leftName => rightNames.some(rightName => samePerson(leftName, rightName)));
}

function uniquePeople(values) {
    const result = [];
    for (const value of values || []) {
        const names = creditNameParts(value, "mixed");
        const candidate = {
            name_en: value?.name_en || names.english || "",
            name_ru: value?.name_ru || names.russian || "",
            display_name: value?.display_name || names.raw || names.english || names.russian || "",
            role: value?.role || ""
        };
        if (!(candidate.name_en || candidate.name_ru)) continue;
        const previous = result.find(item => sameCreditPerson(item, candidate));
        if (!previous) {
            result.push(candidate);
            continue;
        }
        previous.name_en ||= candidate.name_en;
        previous.name_ru ||= candidate.name_ru;
        previous.display_name ||= candidate.display_name;
        if (!previous.role && candidate.role) previous.role = candidate.role;
    }
    return result;
}

function parseKinopoiskCastPage(html) {
    const actors = [...parseEmbeddedCredits(html, "kp")];
    const directors = [];
    const links = [...String(html || "").matchAll(/<a\b[^>]*href=['"][^'"]*\/name\/(?:nm)?\d+[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi)];
    links.forEach((match, index) => {
        const section = kinopoiskSectionBefore(html, match.index || 0);
        if (!section) return;
        const next = links[index + 1]?.index ?? Math.min(String(html).length, (match.index || 0) + 2400);
        const chunk = String(html).slice(match.index || 0, next);
        const names = kinopoiskNameParts(match[1], chunk);
        if (!(names.english || names.russian)) return;
        if (section === "director") {
            directors.push({ name_en: names.english, name_ru: names.russian,
                display_name: names.display });
            return;
        }
        actors.push({ name_en: names.english, name_ru: names.russian,
            display_name: names.display, role: kinopoiskRoleFromChunk(chunk) });
    });
    return {
        actors: uniquePeople(actors),
        directors: uniquePeople(directors)
    };
}

function uniqueCredits(values) {
    const map = new Map();
    for (const value of values || []) {
        const role = creditRoleText(value?.role);
        const names = creditNameParts(value, "mixed");
        const english = value?.name_en || names.english;
        const russian = value?.name_ru || names.russian;
        if (!role || !(english || russian)) continue;
        const nameKey = [...personMatchKeys(english || russian)][0] || normalizePersonMatchKey(english || russian);
        const key = `${nameKey}|${role.toLocaleLowerCase("ru")}`;
        const previous = map.get(key);
        map.set(key, {
            name_en: previous?.name_en || english || "",
            name_ru: previous?.name_ru || russian || "",
            display_name: previous?.display_name || value?.display_name || names.raw || english || russian || "",
            role
        });
    }
    return [...map.values()];
}

function parseCreditPage(html, source) {
    return uniqueCredits([
        ...parseEmbeddedCredits(html, source),
        ...parseAnchorCredits(html, source)
    ]);
}

function imdbSectionBefore(html, index) {
    const plain = htmlPlain(String(html || "").slice(0, index)).replace(/\s+/g, " ").trim();
    const markers = [...plain.matchAll(/(?:^|\s)(Full\s+Cast|Cast|Directed\s+by|Director|Directors)(?=\s|$)/gi)];
    const marker = markers.at(-1)?.[1] || "";
    if (/directed\s+by|directors?/i.test(marker)) return "director";
    if (/full\s+cast|cast/i.test(marker)) return "actor";
    return "";
}

function parseImdbFullcredits(html) {
    const actors = [...parseEmbeddedCredits(html, "imdb")];
    const directors = [];
    const links = [...String(html || "").matchAll(/<a\b[^>]*href=['"][^'"]*\/name\/(?:nm)?\d+[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi)];
    links.forEach((match, index) => {
        const name = htmlPlain(match[1]);
        const next = links[index + 1]?.index ?? Math.min(String(html).length, (match.index || 0) + 2400);
        const chunk = String(html).slice(match.index || 0, next);
        const role = roleFromCreditChunk(chunk);
        const section = imdbSectionBefore(html, match.index || 0);
        if (!name || name.length > 120 || (section !== "director" && !role)) return;
        const names = creditNameParts(name, "imdb");
        const credit = { name_en: names.english || name, display_name: name, role };
        if (section === "director") {
            directors.push({ name_en: names.english || name, display_name: name });
        } else {
            // Если IMDb не отдал заголовок секции, сохраняем прежнее поведение:
            // ссылка с актерской ролью считается актером.
            actors.push(credit);
        }
    });
    return {
        actors: uniqueCredits(actors),
        directors: uniquePeople(directors)
    };
}

function parseImdbGraphqlCredits(data) {
    const castEdges = data?.data?.title?.credits?.edges
        || data?.data?.title?.mainColumnData?.cast?.edges
        || [];
    const directorEdges = data?.data?.title?.directorCredits?.edges || [];
    const edges = [...castEdges, ...directorEdges];
    const actors = [];
    const directors = [];
    edges.forEach(edge => {
        const node = edge?.node || edge || {};
        const name = node.name || node.person || {};
        const displayName = valueText(name.nameText?.text || name.nameText || name.text || name);
        if (!displayName) return;
        const category = String(node.category?.id || node.category?.text || "").toLowerCase();
        if (category === "director" || category === "directors") {
            directors.push({ name_en: displayName, display_name: displayName });
            return;
        }
        // Узлы Crew с другой category не должны попадать в список актёров.
        if (category) return;
        const role = valueText(node.characters || node.character || node.roles)
            || valueText(node.attributes);
        if (role) actors.push({ name_en: displayName, display_name: displayName, role });
    });
    return { actors: uniqueCredits(actors), directors: uniquePeople(directors) };
}

async function imdbCredits(ob, imdbId) {
    const id = extractImdbId(imdbId);
    if (!id) return { actors: [], directors: [] };
    let parsed = { actors: [], directors: [] };
    for (const base of ["https://www.imdb.com", "https://m.imdb.com"]) {
        const html = await getText(ob, `${base}/title/${id}/fullcredits/`, {
            Referer: `https://www.imdb.com/title/${id}/`
        });
        parsed = parseImdbFullcredits(html);
        if (parsed.actors.length || parsed.directors.length) break;
    }
    const htmlCredits = parsed.actors;
    const query = [
        "query TitleCredits($id: ID!, $after: ID) {",
        "  title(id: $id) {",
        "    credits(first: 100, after: $after) {",
        "      edges {",
        "        node {",
        "          name { nameText { text } }",
        "          ... on Cast { characters { name } }",
        "          ... on Crew { category { id text } }",
        "          attributes { text }",
        "        }",
        "      }",
        "      pageInfo { hasNextPage endCursor }",
        "    }",
        "    directorCredits: credits(first: 10, filter: { categories: [\"director\"] }) {",
        "      edges {",
        "        node {",
        "          name { nameText { text } }",
        "          ... on Crew { category { id text } }",
        "        }",
        "      }",
        "    }",
        "  }",
        "}"
    ].join("\n");
    for (const endpoint of ["https://graphql.imdb.com/", "https://api.graphql.imdb.com/"]) {
        const actors = [];
        const directors = [];
        let after = null;
        for (let page = 0; page < 5; page++) {
            const data = await postJson(ob, endpoint, {
                operationName: "TitleCredits",
                query,
                variables: { id, after }
            });
            const credits = parseImdbGraphqlCredits(data);
            actors.push(...credits.actors);
            directors.push(...credits.directors);
            const pageInfo = data?.data?.title?.credits?.pageInfo;
            if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
            after = pageInfo.endCursor;
        }
        if (actors.length || directors.length) return {
            actors: uniqueCredits([...htmlCredits, ...actors]),
            directors: uniquePeople([...parsed.directors, ...directors])
        };
    }
    return parsed;
}

function asPeople(value) {
    return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizeApiCredit(person) {
    const names = creditNameParts(person, "mixed");
    const role = roleParts(person);
    return {
        name_en: person?.name_en || names.english || "",
        name_ru: person?.name_ru || names.russian || "",
        display_name: person?.display_name || names.raw || names.english || names.russian || "",
        role: person?.role || role.english || role.russian || "",
        role_en: person?.role_en || role.english || "",
        role_ru: person?.role_ru || role.russian || ""
    };
}

function normalizeKpApiCast(cast) {
    const rawActors = asPeople(cast?.actors ?? cast?.actor ?? cast?.cast);
    const rawDirectors = [...asPeople(cast?.directors), ...asPeople(cast?.director)];
    const actors = rawActors.map(normalizeApiCredit)
        .filter(person => person.name_en || person.name_ru);
    const directors = uniquePeople(rawDirectors.map(normalizeApiCredit)
        .filter(person => person.name_en || person.name_ru));
    return { actors: uniqueRoleCredits(actors), directors };
}

function uniqueRoleCredits(values) {
    const result = [];
    const seen = new Set();
    for (const person of values || []) {
        const name = sourcePersonName(person);
        const role = sourcePersonRole(person, "Актеры");
        const key = `${name.toLocaleLowerCase("en")}|${role.toLocaleLowerCase("ru")}`;
        if (!name || seen.has(key)) continue;
        seen.add(key);
        result.push(person);
    }
    return result;
}

function mergeKpCredits(left, right) {
    return {
        actors: uniqueRoleCredits([...(left?.actors || []), ...(right?.actors || [])]),
        directors: uniquePeople([...(left?.directors || []), ...(right?.directors || [])])
    };
}

async function getKpApiCredits(ob, kpId) {
    const id = String(kpId || "").match(/^\d{1,12}$/)?.[0] || "";
    if (!id) return { actors: [], directors: [] };
    const officialLike = kpApiStaffCredits(await kpApiJson(ob, "/v1/staff", { filmId: id }));
    if (officialLike.actors.length || officialLike.directors.length) return officialLike;
    const result = await getJson(ob, `https://movie-planner.ru/api/public/film/${id}`);
    return normalizeKpApiCast(result?.cast);
}

async function kinopoiskCredits(ob, kpId, type) {
    const id = String(kpId || "").match(/^\d{1,12}$/)?.[0] || "";
    if (!id) return { actors: [], directors: [] };

    // КП API - основной источник состава. Если он вернул актеров и режиссера,
    // не дергаем HTML Кинопоиска вообще: это быстрее и не упирается в антибот.
    const apiCredits = await getKpApiCredits(ob, id);
    if (apiCredits.actors.length && apiCredits.directors.length) return apiCredits;

    // HTML остается только резервом для редких случаев неполного ответа API.
    const paths = type === "series" ? ["series", "film"] : ["film", "series"];
    let pageCredits = { actors: [], directors: [] };
    for (const path of paths) {
        const html = await getText(ob, `https://www.kinopoisk.ru/${path}/${id}/cast/`, {
            Referer: `https://www.kinopoisk.ru/${path}/${id}/`
        });
        const cast = parseKinopoiskCastPage(html);
        const credits = parseCreditPage(html, "kp");
        pageCredits = mergeKpCredits(pageCredits, {
            actors: [...cast.actors, ...credits],
            directors: cast.directors
        });
    }
    return mergeKpCredits(apiCredits, pageCredits);
}

async function loadActorCredits(ob, imdbId, kpId, type, status) {
    let kpCast = { actors: [], directors: [] };
    if (kpId) {
        status?.("получаю состав через КП API…");
        kpCast = await kinopoiskCredits(ob, kpId, type);
    }

    // IMDb - резерв и дополнение. Он нужен прежде всего для случаев, когда КП
    // не вернул состав/роли, а также для совместимости со старыми карточками.
    let imdbResult = { actors: [], directors: [] };
    if (imdbId && (!kpCast.actors.length || !kpCast.directors.length)) {
        status?.("КП состав неполный, проверяю IMDb…");
        imdbResult = await imdbCredits(ob, imdbId);
    }
    return { imdb: imdbResult.actors, imdbDirectors: imdbResult.directors,
        kp: kpCast.actors, directors: kpCast.directors };
}

async function wikidata(get, id) {
    const query = `SELECT DISTINCT ?item ?kp ?ru ?article ?series ?seriesLabel WHERE {
      ?item wdt:P345 "${id}" .
      OPTIONAL { ?item wdt:P2603 ?kp . }
      OPTIONAL { ?item rdfs:label ?ru . FILTER(LANG(?ru)="ru") }
      OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://ru.wikipedia.org/> . }

      SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en" . }
    } LIMIT 100`;
    return parseWikidata(await get("https://query.wikidata.org/sparql",{format:"json",query}));
}
function parseWikidata(data) {
    const rows = data?.results?.bindings || [];
    const empty = {title:"",kp:"",article:"",series:[]};
    if (rows.length >= 100 || new Set(rows.map(x=>x.item?.value)).size !== 1) return empty;
    const item = rows[0]?.item?.value;
    if (!/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(item || "")) return empty;
    const unique = key => [...new Set(rows.map(x=>x[key]?.value).filter(Boolean))];
    const kps = unique("kp");
    const series = new Map();
    for (const row of rows) {
        if (!/^https?:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(row.series?.value || "")) continue;
        const qid = row.series.value.split("/").pop(), name = row.seriesLabel?.value;
        if (name && name !== qid) series.set(qid,{name,origin:"Wikidata",url:`https://www.wikidata.org/wiki/${item.split("/").pop()}#P179`});
    }
    return { title:unique("ru")[0] || "", kp:kps.length === 1 && /^\d+$/.test(kps[0]) ? kps[0] : "",
        article:unique("article").find(x=>x.startsWith("https://ru.wikipedia.org/wiki/")) || "", series:[...series.values()] };
}

async function kinopoisk(get, qa, movie, wiki, ob) {
    const base = "https://movie-planner.ru/api/public";
    if (wiki.kp) {
        const fromWiki = await kinopoiskById(get, wiki.kp, ob);
        if (fromWiki) return fromWiki;
    }
    // КП API особенно полезен для русских названий и новых фильмов.
    const apiQuery = russian(movie.Title) || movie.Title;
    const apiFound = await kpApiJson(ob, "/v2.1/films/search-by-keyword", { keyword: apiQuery, page: 1 });
    const apiCandidates = (apiFound?.films || []).filter(item => {
        const yearOk = !movie.Year || !item.year || String(item.year).slice(0,4) === String(movie.Year).slice(0,4);
        return yearOk;
    });
    if (apiCandidates.length === 1) {
        const apiDetails = await kinopoiskById(get, apiCandidates[0].filmId, ob);
        if (apiDetails) return apiDetails;
    }
    // Сначала проверяем точную связь по IMDb ID. Поиск только по названию
    // ломался на локализованных названиях вроде tt2395385.
    const directSearch = await get(`${base}/search`, {
        q: movie.imdbID, limit: 24, person_limit: 0
    });
    const exact = (directSearch?.items || []).filter(item =>
        extractImdbId(item.imdb_id || item.imdbID) === extractImdbId(movie.imdbID));
    const exactIds = [...new Set(exact.map(item => String(item.kp_id || "")).filter(Boolean))];
    if (exactIds.length === 1) {
        const exactDetails = await kinopoiskById(get, exactIds[0], ob);
        if (exactDetails) return exactDetails;
    }
    const year = Number(String(movie.Year || "").match(/\d{4}/)?.[0]);
    const candidates = new Map();
    for (const q of [...new Set([wiki.title, `${movie.Title} ${year}`, movie.Title].filter(Boolean))]) {
        const result = await get(`${base}/search`, { q, limit:24, type:movie.Type === "series" ? "series" : "film",person_limit:0 });
        for (const item of result?.items || []) {
            // Разница премьер в один год допустима только после ручного выбора.
            if (Math.abs(Number(item.year)-year) <= 1 && Boolean(item.is_series) === (movie.Type === "series")) candidates.set(String(item.kp_id), item);
        }
        if (candidates.size) break;
    }
    if (!candidates.size) return null;
    const items = [...candidates.values()].slice(0,12);
    const skip = {skip:true};
    const chosen = await qa.suggester([...items.map(x=>`${x.title} (${x.year}) - КП ${x.kp_id}`),"Пропустить"],[...items,skip],`Подтверди фильм КП: ${movie.Title} (${movie.Year})`);
    if (!chosen || chosen.skip) return null;
    const details = await kinopoiskById(get, chosen.kp_id, ob);
    return details || {...chosen, cast:{}};
}
async function kinopoiskById(get, kpId, ob = null) {
    const id = String(kpId || "").trim();
    if (!/^\d{1,12}$/.test(id)) return null;
    if (ob) {
        const apiFilm = kpApiFilmLegacy(await kpApiJson(ob, `/v2.2/films/${id}`));
        if (apiFilm) return apiFilm;
    }
    let result;
    try { result = await get(`https://movie-planner.ru/api/public/film/${id}`); } catch { result = null; }
    const film = result?.film;
    if (!film) {
        if (result && (result.found === false || result.status === 404 || /not.found|не найден/i.test(String(result.error || "")))) return null;
        return { kp_id: id, cast: {}, detailsUnavailable: true };
    }
    if (String(film.kp_id) !== id) return null;
    return {...film, cast: result?.cast || {}};
}
async function wikiDescription(get, article) {
    const title = decodeURIComponent(new URL(article).pathname.slice(6)).replace(/_/g," ");
    const response = await get("https://ru.wikipedia.org/w/api.php",{action:"query",format:"json",prop:"extracts",titles:title,redirects:1,explaintext:1,exintro:1});
    const page = Object.values(response?.query?.pages || {})[0];
    return russian(page?.extract)?.trim() || "";
}

async function ensureFranchise(app, ob, choice, id) {
    let file = app.vault.getAbstractFileByPath(choice.path);
    const marker = "<!-- FRANCHISE:TABLE:v1 -->";
    const table = marker + "\n## Произведения\n\n```dataviewjs\n" + renderFranchise.toString() + "\nrenderFranchise(dv);\n```\n";
    if (file) {
        if (file.extension !== "md") throw new Error("Путь франшизы занят папкой.");
        const fm = await frontmatter(app, ob, file);
        const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
        if (fm["imdb Id"] || fm["Фильм"] || fm["Сериал"] || tags.some(x=>["movies","serial","season","viewing"].includes(String(x).replace(/^#/,"")))) throw new Error("Выбранная страница не является франшизой.");
    } else {
        await ensureFolder(app,choice.path.split("/").slice(0,-1).join("/"));
        file = await app.vault.create(choice.path,"---\ntags:\n  - franchise\nПорядок: выход\n---\n\n# " + safeName(choice.name) + "\n\n## Общее впечатление\n\n" + table);
    }
    await app.vault.process(file,raw=>{
        if (!raw.includes(marker)) raw=raw.trimEnd()+"\n\n"+table;
        const sourceMarker=`<!-- FRANCHISE:SOURCE:${id} -->`;
        if (choice.url && !raw.includes(sourceMarker)) raw=raw.trimEnd()+`\n\n${sourceMarker}\nИсточник связи для IMDb ${id}: [${choice.origin}](${choice.url}).\n`;
        return raw;
    });
}

function renderFranchise(dv) {
    const current = dv.current();
    function number(value) {
        if (value == null || String(value).trim() === "") return null;
        const result = Number(String(value).replace(",", "."));
        return Number.isFinite(result) ? result : null;
    }
    function release(value) {
        if (value?.toMillis) return value.toMillis();
        if (value instanceof Date) return value.getTime();
        const text = String(value ?? "").trim();
        if (/^\d{4}$/.test(text)) return Date.UTC(Number(text), 0, 1);
        const ru = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const result = ru ? Date.UTC(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1])) : Date.parse(text);
        return Number.isFinite(result) ? result : Infinity;
    }
    function belongs(page) {
        const refs = Array.isArray(page["Франшиза"]) ? page["Франшиза"] : [page["Франшиза"]];
        return refs.some(ref => {
            if (!ref) return false;
            const path = typeof ref === "object" ? ref.path : String(ref).replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0];
            return path && dv.page(path)?.file.path === current.file.path;
        });
    }
    const rows = dv.pages('"Кино"').array().filter(page => {
        if (["Просмотры", "Сезоны", "Франшизы"].some(folder => page.file.path.startsWith(`Кино/${folder}/`))) return false;
        const tags = (Array.isArray(page.tags) ? page.tags : [page.tags]).filter(Boolean)
            .map(tag => String(tag).replace(/^#/, ""));
        return tags.some(tag => tag === "movies" || tag === "serial") && belongs(page);
    });
    const byPart = String(current["Порядок"] ?? "").toLowerCase() === "части";
    rows.sort((a, b) => {
        const dates = release(a["Релиз"]) - release(b["Релиз"]);
        const parts = (number(a["Часть"]) ?? Infinity) - (number(b["Часть"]) ?? Infinity);
        return (byPart ? (parts || dates) : (dates || parts)) || a.file.name.localeCompare(b.file.name, "ru");
    });
    dv.paragraph(`Произведений: ${rows.length}. Порядок: ${byPart ? "по номерам частей" : "по дате выхода"}.`);
    if (!rows.length) {
        dv.paragraph("Добавь произведения командой QuickAdd «Франшиза».");
        return;
    }
    dv.table(["Часть", "Произведение", "Релиз", "Моя оценка", "КП", "IMDb"], rows.map(page => [
        number(page["Часть"]) ?? "-", page.file.link, page["Релиз"] ?? "-",
        number(page["Оценка"]) ?? "-", number(page["Оценка Кинопоиск"]) ?? "-",
        number(page["Оценка Imdb"]) ?? "-"
    ]));
}



const CATALOG = {
  "tt0364146": [
    {
      "name": "10.5 баллов",
      "url": "https://en.wikipedia.org/wiki/10.5%3A_Apocalypse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0463850": [
    {
      "name": "10.5 баллов",
      "url": "https://en.wikipedia.org/wiki/10.5%3A_Apocalypse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0240772": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0349903": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0496806": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5164214": [
    {
      "name": "Друзья Оушена",
      "url": "https://en.wikipedia.org/wiki/Ocean%27s_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0414852": [
    {
      "name": "13-й район",
      "url": "https://en.wikipedia.org/wiki/District_13",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1247640": [
    {
      "name": "13-й район",
      "url": "https://en.wikipedia.org/wiki/District_13",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1430612": [
    {
      "name": "13-й район",
      "url": "https://en.wikipedia.org/wiki/District_13",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4427076": [
    {
      "name": "14+",
      "url": "https://ru.wikipedia.org/wiki/14%2B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0289043": [
    {
      "name": "28 дней спустя",
      "url": "https://en.wikipedia.org/wiki/28_Days_Later_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0091635": [
    {
      "name": "Девять с половиной недель",
      "url": "https://en.wikipedia.org/wiki/Another_9%C2%BD_Weeks",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1846473": [
    {
      "name": "Всё включено",
      "url": "https://ru.wikipedia.org/wiki/%D0%92%D1%81%D1%91_%D0%B2%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3194426": [
    {
      "name": "Всё включено",
      "url": "https://ru.wikipedia.org/wiki/%D0%92%D1%81%D1%91_%D0%B2%D0%BA%D0%BB%D1%8E%D1%87%D0%B5%D0%BD%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0419706": [
    {
      "name": "Doom",
      "url": "https://en.wikipedia.org/wiki/Doom_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0903747": [
    {
      "name": "Во все тяжкие",
      "url": "https://en.wikipedia.org/wiki/Breaking_Bad_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3032476": [
    {
      "name": "Во все тяжкие",
      "url": "https://en.wikipedia.org/wiki/Breaking_Bad_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9243946": [
    {
      "name": "Во все тяжкие",
      "url": "https://en.wikipedia.org/wiki/Breaking_Bad_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1046173": [
    {
      "name": "G.I. Joe",
      "url": "https://en.wikipedia.org/wiki/G.I._Joe_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1583421": [
    {
      "name": "G.I. Joe",
      "url": "https://en.wikipedia.org/wiki/G.I._Joe_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7737786": [
    {
      "name": "Гренландия",
      "url": "https://en.wikipedia.org/wiki/Greenland%3A_Migration",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2802144": [
    {
      "name": "Kingsman",
      "url": "https://en.wikipedia.org/wiki/Kingsman_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4649466": [
    {
      "name": "Kingsman",
      "url": "https://en.wikipedia.org/wiki/Kingsman_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6856242": [
    {
      "name": "Kingsman",
      "url": "https://en.wikipedia.org/wiki/Kingsman_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3013602": [
    {
      "name": "Superнянь",
      "url": "https://en.wikipedia.org/wiki/Babysitting_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4400058": [
    {
      "name": "Superнянь",
      "url": "https://en.wikipedia.org/wiki/Babysitting_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0146316": [
    {
      "name": "Лара Крофт",
      "url": "https://en.wikipedia.org/wiki/Tomb_Raider_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0325703": [
    {
      "name": "Лара Крофт",
      "url": "https://en.wikipedia.org/wiki/Tomb_Raider_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1365519": [
    {
      "name": "Лара Крофт",
      "url": "https://en.wikipedia.org/wiki/Tomb_Raider_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1307824": [
    {
      "name": "V",
      "url": "https://en.wikipedia.org/wiki/V_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13560574": [
    {
      "name": "X",
      "url": "https://en.wikipedia.org/wiki/X_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1156398": [
    {
      "name": "Зомбилэнд",
      "url": "https://en.wikipedia.org/wiki/Zombieland_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1560220": [
    {
      "name": "Зомбилэнд",
      "url": "https://en.wikipedia.org/wiki/Zombieland_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0499549": [
    {
      "name": "Аватар",
      "url": "https://en.wikipedia.org/wiki/Avatar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1630029": [
    {
      "name": "Аватар",
      "url": "https://en.wikipedia.org/wiki/Avatar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1757678": [
    {
      "name": "Аватар",
      "url": "https://en.wikipedia.org/wiki/Avatar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0274166": [
    {
      "name": "Джонни Инглиш",
      "url": "https://en.wikipedia.org/wiki/Johnny_English_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1634122": [
    {
      "name": "Джонни Инглиш",
      "url": "https://en.wikipedia.org/wiki/Johnny_English_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6921996": [
    {
      "name": "Джонни Инглиш",
      "url": "https://en.wikipedia.org/wiki/Johnny_English_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0313911": [
    {
      "name": "Агент Коди Бэнкс",
      "url": "https://en.wikipedia.org/wiki/Agent_Cody_Banks_2%3A_Destination_London",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0358349": [
    {
      "name": "Агент Коди Бэнкс",
      "url": "https://en.wikipedia.org/wiki/Agent_Cody_Banks_2%3A_Destination_London",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1638355": [
    {
      "name": "Агенты А.Н.К.Л.",
      "url": "https://en.wikipedia.org/wiki/The_Man_from_U.N.C.L.E._%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0479884": [
    {
      "name": "Адреналин",
      "url": "https://en.wikipedia.org/wiki/Crank%3A_High_Voltage",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1121931": [
    {
      "name": "Адреналин",
      "url": "https://en.wikipedia.org/wiki/Crank%3A_High_Voltage",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1477834": [
    {
      "name": "Аквамен",
      "url": "https://en.wikipedia.org/wiki/Aquaman_and_the_Lost_Kingdom",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6139732": [
    {
      "name": "Аладдин",
      "url": "https://en.wikipedia.org/wiki/Aladdin_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0415481": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0465967": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1189893": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1796657": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2592484": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4544278": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6389344": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7548114": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8682096": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13811736": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14469640": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt27526478": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt37167782": [
    {
      "name": "Три богатыря",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D0%B8_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8F_%28%D1%84%D1%80%D0%B0%D0%BD%D1%88%D0%B8%D0%B7%D0%B0%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0090390": [
    {
      "name": "Альф",
      "url": "https://en.wikipedia.org/wiki/Project_ALF",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0163651": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0252866": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0328828": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0436058": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808146": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0974959": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1407050": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1605630": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11771594": [
    {
      "name": "Американский пирог",
      "url": "https://en.wikipedia.org/wiki/American_Pie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0144084": [
    {
      "name": "Американский психопат",
      "url": "https://en.wikipedia.org/wiki/American_Psycho_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0283877": [
    {
      "name": "Американский психопат",
      "url": "https://en.wikipedia.org/wiki/American_Psycho_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0382625": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808151": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3062096": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10478054": [
    {
      "name": "Роберт Лэнгдон",
      "url": "https://en.wikipedia.org/wiki/Robert_Langdon_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0993840": [
    {
      "name": "Армия мертвецов",
      "url": "https://en.wikipedia.org/wiki/Army_of_the_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13024674": [
    {
      "name": "Армия мертвецов",
      "url": "https://en.wikipedia.org/wiki/Army_of_the_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0133385": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0250223": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0463872": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1597522": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11210390": [
    {
      "name": "Астерикс и Обеликс",
      "url": "https://en.wikipedia.org/wiki/List_of_Asterix_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0480239": [
    {
      "name": "Атлант расправил плечи",
      "url": "https://en.wikipedia.org/wiki/Atlas_Shrugged_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1985017": [
    {
      "name": "Атлант расправил плечи",
      "url": "https://en.wikipedia.org/wiki/Atlas_Shrugged_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2800038": [
    {
      "name": "Атлант расправил плечи",
      "url": "https://en.wikipedia.org/wiki/Atlas_Shrugged_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0418279": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1055369": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1399103": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2109248": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3371366": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4701182": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5090568": [
    {
      "name": "Трансформеры",
      "url": "https://en.wikipedia.org/wiki/Transformers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14111652": [
    {
      "name": "Батя",
      "url": "https://ru.wikipedia.org/wiki/%D0%91%D0%B0%D1%82%D1%8F_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1790864": [
    {
      "name": "Бегущий в лабиринте",
      "url": "https://en.wikipedia.org/wiki/Maze_Runner_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4046784": [
    {
      "name": "Бегущий в лабиринте",
      "url": "https://en.wikipedia.org/wiki/Maze_Runner_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4500922": [
    {
      "name": "Бегущий в лабиринте",
      "url": "https://en.wikipedia.org/wiki/Maze_Runner_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0412915": [
    {
      "name": "Библиотекарь",
      "url": "https://en.wikipedia.org/wiki/The_Librarian_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0455596": [
    {
      "name": "Библиотекарь",
      "url": "https://en.wikipedia.org/wiki/The_Librarian_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1146438": [
    {
      "name": "Библиотекарь",
      "url": "https://en.wikipedia.org/wiki/The_Librarian_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0800320": [
    {
      "name": "Битва титанов",
      "url": "https://en.wikipedia.org/wiki/Clash_of_the_Titans_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1646987": [
    {
      "name": "Битва титанов",
      "url": "https://en.wikipedia.org/wiki/Clash_of_the_Titans_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0250494": [
    {
      "name": "Блондинка в законе",
      "url": "https://en.wikipedia.org/wiki/Legally_Blonde_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0333780": [
    {
      "name": "Блондинка в законе",
      "url": "https://en.wikipedia.org/wiki/Legally_Blonde_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7605074": [
    {
      "name": "Блуждающая Земля",
      "url": "https://en.wikipedia.org/wiki/The_Wandering_Earth_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13539646": [
    {
      "name": "Блуждающая Земля",
      "url": "https://en.wikipedia.org/wiki/The_Wandering_Earth_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1520211": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3743822": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9859436": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13062500": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt18546730": [
    {
      "name": "Ходячие мертвецы",
      "url": "https://en.wikipedia.org/wiki/The_Walking_Dead_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0348333": [
    {
      "name": "Большая жратва",
      "url": "https://en.wikipedia.org/wiki/Still_Waiting...",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0208003": [
    {
      "name": "Дом большой мамочки",
      "url": "https://en.wikipedia.org/wiki/Big_Momma%27s_House_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0421729": [
    {
      "name": "Дом большой мамочки",
      "url": "https://en.wikipedia.org/wiki/Big_Momma%27s_House_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1464174": [
    {
      "name": "Дом большой мамочки",
      "url": "https://en.wikipedia.org/wiki/Big_Momma%27s_House_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0337898": [
    {
      "name": "Бригада",
      "url": "https://ru.wikipedia.org/wiki/%D0%91%D1%80%D0%B8%D0%B3%D0%B0%D0%B4%D0%B0%3A_%D0%9D%D0%B0%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1765729": [
    {
      "name": "Бригада",
      "url": "https://ru.wikipedia.org/wiki/%D0%91%D1%80%D0%B8%D0%B3%D0%B0%D0%B4%D0%B0%3A_%D0%9D%D0%B0%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0243155": [
    {
      "name": "Бриджит Джонс",
      "url": "https://en.wikipedia.org/wiki/Bridget_Jones_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0317198": [
    {
      "name": "Бриджит Джонс",
      "url": "https://en.wikipedia.org/wiki/Bridget_Jones_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0315327": [
    {
      "name": "Брюс и Эван Всемогущие",
      "url": "https://en.wikipedia.org/wiki/Evan_Almighty",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0413099": [
    {
      "name": "Брюс и Эван Всемогущие",
      "url": "https://en.wikipedia.org/wiki/Evan_Almighty",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1173907": [
    {
      "name": "Жизнь после людей",
      "url": "https://en.wikipedia.org/wiki/Life_After_People",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1433058": [
    {
      "name": "Жизнь после людей",
      "url": "https://en.wikipedia.org/wiki/Life_After_People",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2975590": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0974015": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0770828": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1386697": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7713068": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0439572": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9362930": [
    {
      "name": "Расширенная вселенная DC",
      "url": "https://en.wikipedia.org/wiki/DC_Extended_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6015328": [
    {
      "name": "В погоне за драконами",
      "url": "https://en.wikipedia.org/wiki/Chasing_the_Dragon_II%3A_Wild_Wild_Bunch",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1075417": [
    {
      "name": "Ведьмина гора",
      "url": "https://en.wikipedia.org/wiki/Witch_Mountain_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0455944": [
    {
      "name": "Великий уравнитель",
      "url": "https://en.wikipedia.org/wiki/The_Equalizer_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1270797": [
    {
      "name": "Веном",
      "url": "https://en.wikipedia.org/wiki/Venom_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7097896": [
    {
      "name": "Веном",
      "url": "https://en.wikipedia.org/wiki/Venom_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9032400": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt20969586": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10857160": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9140554": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0800080": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3480822": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9376612": [
    {
      "name": "Киновселенная Marvel",
      "url": "https://en.wikipedia.org/wiki/Marvel_Cinematic_Universe",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2261227": [
    {
      "name": "Видоизменённый углерод",
      "url": "https://en.wikipedia.org/wiki/Altered_Carbon%3A_Resleeved",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120737": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0167261": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0167260": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0903624": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1170358": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2310332": [
    {
      "name": "Средиземье",
      "url": "https://en.wikipedia.org/wiki/Middle-earth_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0080453": [
    {
      "name": "Голубая лагуна",
      "url": "https://en.wikipedia.org/wiki/Blue_Lagoon%3A_The_Awakening",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0102782": [
    {
      "name": "Голубая лагуна",
      "url": "https://en.wikipedia.org/wiki/Blue_Lagoon%3A_The_Awakening",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2287663": [
    {
      "name": "Голубая лагуна",
      "url": "https://en.wikipedia.org/wiki/Blue_Lagoon%3A_The_Awakening",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0054189": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0134119": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0265651": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0219171": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11016042": [
    {
      "name": "Том Рипли",
      "url": "https://en.wikipedia.org/wiki/Tom_Ripley",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0133152": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1318514": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2103281": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3450958": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11389872": [
    {
      "name": "Планета обезьян",
      "url": "https://en.wikipedia.org/wiki/Planet_of_the_Apes",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2356464": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3849938": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5311972": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9182284": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11560730": [
    {
      "name": "Восточный ветер",
      "url": "https://en.wikipedia.org/wiki/Windstorm_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1456635": [
    {
      "name": "Вышибала",
      "url": "https://en.wikipedia.org/wiki/Goon%3A_Last_of_the_Enforcers",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1323594": [
    {
      "name": "Гадкий я и Миньоны",
      "url": "https://en.wikipedia.org/wiki/Despicable_Me",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1690953": [
    {
      "name": "Гадкий я и Миньоны",
      "url": "https://en.wikipedia.org/wiki/Despicable_Me",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2293640": [
    {
      "name": "Гадкий я и Миньоны",
      "url": "https://en.wikipedia.org/wiki/Despicable_Me",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0366551": [
    {
      "name": "Гарольд и Кумар",
      "url": "https://en.wikipedia.org/wiki/Harold_%26_Kumar",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0481536": [
    {
      "name": "Гарольд и Кумар",
      "url": "https://en.wikipedia.org/wiki/Harold_%26_Kumar",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1268799": [
    {
      "name": "Гарольд и Кумар",
      "url": "https://en.wikipedia.org/wiki/Harold_%26_Kumar",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0241527": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0295297": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0304141": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0330373": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0373889": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0417741": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0926084": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1201607": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3183660": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4123430": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4123432": [
    {
      "name": "Волшебный мир Гарри Поттера",
      "url": "https://en.wikipedia.org/wiki/Wizarding_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0473705": [
    {
      "name": "На игре",
      "url": "https://ru.wikipedia.org/wiki/%D0%93%D0%B5%D0%B9%D0%BC%D0%B5%D1%80%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1620549": [
    {
      "name": "На игре",
      "url": "https://ru.wikipedia.org/wiki/%D0%93%D0%B5%D0%B9%D0%BC%D0%B5%D1%80%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4216630": [
    {
      "name": "На игре",
      "url": "https://ru.wikipedia.org/wiki/%D0%93%D0%B5%D0%B9%D0%BC%D0%B5%D1%80%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0813715": [
    {
      "name": "Герои",
      "url": "https://en.wikipedia.org/wiki/Heroes_Reborn_%28miniseries%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3556944": [
    {
      "name": "Герои",
      "url": "https://en.wikipedia.org/wiki/Heroes_Reborn_%28miniseries%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0172495": [
    {
      "name": "Гладиатор",
      "url": "https://en.wikipedia.org/wiki/Gladiator_II",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0831387": [
    {
      "name": "Годзилла - MonsterVerse",
      "url": "https://en.wikipedia.org/wiki/MonsterVerse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1392170": [
    {
      "name": "Голодные игры",
      "url": "https://en.wikipedia.org/wiki/The_Hunger_Games_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0087363": [
    {
      "name": "Гремлины",
      "url": "https://en.wikipedia.org/wiki/Gremlins_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0099700": [
    {
      "name": "Гремлины",
      "url": "https://en.wikipedia.org/wiki/Gremlins_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9624470": [
    {
      "name": "Громкая связь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BD%D0%B0%D1%8F_%D1%81%D0%B2%D1%8F%D0%B7%D1%8C_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2020%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13652420": [
    {
      "name": "Громкая связь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BD%D0%B0%D1%8F_%D1%81%D0%B2%D1%8F%D0%B7%D1%8C_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2020%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0187636": [
    {
      "name": "Далеко во Вселенной",
      "url": "https://en.wikipedia.org/wiki/Farscape%3A_The_Peacekeeper_Wars",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1568346": [
    {
      "name": "Миллениум",
      "url": "https://en.wikipedia.org/wiki/The_Girl_in_the_Spider%27s_Web_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0773262": [
    {
      "name": "Декстер",
      "url": "https://en.wikipedia.org/wiki/Dexter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14164730": [
    {
      "name": "Декстер",
      "url": "https://en.wikipedia.org/wiki/Dexter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt33043892": [
    {
      "name": "Декстер",
      "url": "https://en.wikipedia.org/wiki/Dexter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0918511": [
    {
      "name": "Деннис-мучитель",
      "url": "https://en.wikipedia.org/wiki/A_Dennis_the_Menace_Christmas",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0428144": [
    {
      "name": "День катастрофы",
      "url": "https://en.wikipedia.org/wiki/Category_7%3A_The_End_of_the_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0468988": [
    {
      "name": "День катастрофы",
      "url": "https://en.wikipedia.org/wiki/Category_7%3A_The_End_of_the_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0116629": [
    {
      "name": "День независимости",
      "url": "https://en.wikipedia.org/wiki/Independence_Day_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1628841": [
    {
      "name": "День независимости",
      "url": "https://en.wikipedia.org/wiki/Independence_Day_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0227538": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0287717": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0338459": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1517489": [
    {
      "name": "Дети шпионов",
      "url": "https://en.wikipedia.org/wiki/Spy_Kids",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0258463": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0372183": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0440963": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1194173": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4196776": [
    {
      "name": "Джейсон Борн",
      "url": "https://en.wikipedia.org/wiki/Bourne_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8367814": [
    {
      "name": "Джентльмены",
      "url": "https://en.wikipedia.org/wiki/The_Gentlemen_%282024_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0263488": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0301470": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1139592": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14121726": [
    {
      "name": "Джиперс Криперс",
      "url": "https://en.wikipedia.org/wiki/Jeepers_Creepers_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2283362": [
    {
      "name": "Джуманджи",
      "url": "https://en.wikipedia.org/wiki/Jumanji_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7975244": [
    {
      "name": "Джуманджи",
      "url": "https://en.wikipedia.org/wiki/Jumanji_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1840309": [
    {
      "name": "Дивергент",
      "url": "https://en.wikipedia.org/wiki/The_Divergent_Series",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2908446": [
    {
      "name": "Дивергент",
      "url": "https://en.wikipedia.org/wiki/The_Divergent_Series",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3410834": [
    {
      "name": "Дивергент",
      "url": "https://en.wikipedia.org/wiki/The_Divergent_Series",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0439358": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0835007": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt12274782": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt28511577": [
    {
      "name": "Диверсант",
      "url": "https://ru.wikipedia.org/wiki/%D0%94%D0%B8%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BD%D1%82_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0378109": [
    {
      "name": "Добро пожаловать в рай",
      "url": "https://en.wikipedia.org/wiki/Into_the_Blue_2%3A_The_Reef",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0865907": [
    {
      "name": "Добро пожаловать в рай",
      "url": "https://en.wikipedia.org/wiki/Into_the_Blue_2%3A_The_Reef",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0118998": [
    {
      "name": "Доктор Дулиттл",
      "url": "https://en.wikipedia.org/wiki/Dr._Dolittle_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0240462": [
    {
      "name": "Доктор Дулиттл",
      "url": "https://en.wikipedia.org/wiki/Dr._Dolittle_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8085790": [
    {
      "name": "Доктор Дулиттл",
      "url": "https://en.wikipedia.org/wiki/Dr._Dolittle_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1211837": [
    {
      "name": "Доктор Стрэндж",
      "url": "https://en.wikipedia.org/wiki/Doctor_Strange_in_the_Multiverse_of_Madness",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9419884": [
    {
      "name": "Доктор Стрэндж",
      "url": "https://en.wikipedia.org/wiki/Doctor_Strange_in_the_Multiverse_of_Madness",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097523": [
    {
      "name": "Дорогая, я уменьшил детей",
      "url": "https://en.wikipedia.org/wiki/Honey%2C_I_Shrunk_the_Kids_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0104437": [
    {
      "name": "Дорогая, я уменьшил детей",
      "url": "https://en.wikipedia.org/wiki/Honey%2C_I_Shrunk_the_Kids_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0119310": [
    {
      "name": "Дорогая, я уменьшил детей",
      "url": "https://en.wikipedia.org/wiki/Honey%2C_I_Shrunk_the_Kids_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0215129": [
    {
      "name": "Дорожное приключение",
      "url": "https://en.wikipedia.org/wiki/Road_Trip%3A_Beer_Pong",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1319733": [
    {
      "name": "Дорожное приключение",
      "url": "https://en.wikipedia.org/wiki/Road_Trip%3A_Beer_Pong",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0374102": [
    {
      "name": "Открытое море",
      "url": "https://en.wikipedia.org/wiki/Open_Water_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0470055": [
    {
      "name": "Открытое море",
      "url": "https://en.wikipedia.org/wiki/Open_Water_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0377092": [
    {
      "name": "Дрянные девчонки",
      "url": "https://en.wikipedia.org/wiki/Mean_Girls_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1679235": [
    {
      "name": "Дрянные девчонки",
      "url": "https://en.wikipedia.org/wiki/Mean_Girls_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1826660": [
    {
      "name": "Духless",
      "url": "https://en.wikipedia.org/wiki/Soulless_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0348914": [
    {
      "name": "Дэдвуд",
      "url": "https://en.wikipedia.org/wiki/Deadwood%3A_The_Movie",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1431045": [
    {
      "name": "Дэдпул",
      "url": "https://en.wikipedia.org/wiki/Deadpool_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5463162": [
    {
      "name": "Дэдпул",
      "url": "https://en.wikipedia.org/wiki/Deadpool_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6263850": [
    {
      "name": "Дэдпул",
      "url": "https://en.wikipedia.org/wiki/Deadpool_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0085995": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0089670": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097958": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120434": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0367623": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1524930": [
    {
      "name": "Каникулы Гризволдов",
      "url": "https://en.wikipedia.org/wiki/National_Lampoon%27s_Vacation_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1034314": [
    {
      "name": "Железное небо",
      "url": "https://en.wikipedia.org/wiki/Iron_Sky%3A_The_Coming_Race",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0371746": [
    {
      "name": "Железный человек",
      "url": "https://en.wikipedia.org/wiki/Iron_Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1228705": [
    {
      "name": "Железный человек",
      "url": "https://en.wikipedia.org/wiki/Iron_Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1300854": [
    {
      "name": "Железный человек",
      "url": "https://en.wikipedia.org/wiki/Iron_Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0088011": [
    {
      "name": "Роман с камнем",
      "url": "https://en.wikipedia.org/wiki/The_Jewel_of_the_Nile",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0089370": [
    {
      "name": "Роман с камнем",
      "url": "https://en.wikipedia.org/wiki/The_Jewel_of_the_Nile",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0057076": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0071807": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097742": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0113189": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120347": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0143145": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0246460": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0381061": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0830515": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1074638": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2379713": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2382320": [
    {
      "name": "Джеймс Бонд",
      "url": "https://en.wikipedia.org/wiki/List_of_James_Bond_films",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0815138": [
    {
      "name": "Заложница",
      "url": "https://en.wikipedia.org/wiki/Taken_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1397280": [
    {
      "name": "Заложница",
      "url": "https://en.wikipedia.org/wiki/Taken_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2446042": [
    {
      "name": "Заложница",
      "url": "https://en.wikipedia.org/wiki/Taken_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5232792": [
    {
      "name": "Затерянные в космосе",
      "url": "https://en.wikipedia.org/wiki/Lost_in_Space_%282018_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0457400": [
    {
      "name": "Затерянный мир - Land of the Lost",
      "url": "https://en.wikipedia.org/wiki/Land_of_the_Lost_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3438354": [
    {
      "name": "Захочу и соскочу",
      "url": "https://en.wikipedia.org/wiki/I_Can_Quit_Whenever_I_Want",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5897288": [
    {
      "name": "Захочу и соскочу",
      "url": "https://en.wikipedia.org/wiki/I_Can_Quit_Whenever_I_Want",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5897292": [
    {
      "name": "Захочу и соскочу",
      "url": "https://en.wikipedia.org/wiki/I_Can_Quit_Whenever_I_Want",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2987732": [
    {
      "name": "Зачётный препод",
      "url": "https://en.wikipedia.org/wiki/Fack_ju_G%C3%B6hte",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3702996": [
    {
      "name": "Зачётный препод",
      "url": "https://en.wikipedia.org/wiki/Fack_ju_G%C3%B6hte",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6471264": [
    {
      "name": "Зачётный препод",
      "url": "https://en.wikipedia.org/wiki/Fack_ju_G%C3%B6hte",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111282": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0118480": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0374455": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0942903": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0929629": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1286039": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7161862": [
    {
      "name": "Звёздные врата",
      "url": "https://en.wikipedia.org/wiki/Stargate",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2948356": [
    {
      "name": "Зверополис",
      "url": "https://en.wikipedia.org/wiki/Zootopia_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0498381": [
    {
      "name": "Звонок",
      "url": "https://en.wikipedia.org/wiki/The_Ring_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120201": [
    {
      "name": "Звёздный десант",
      "url": "https://en.wikipedia.org/wiki/Starship_Troopers_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0212338": [
    {
      "name": "Знакомство с родителями",
      "url": "https://en.wikipedia.org/wiki/Meet_the_Parents_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0290002": [
    {
      "name": "Знакомство с родителями",
      "url": "https://en.wikipedia.org/wiki/Meet_the_Parents_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0970866": [
    {
      "name": "Знакомство с родителями",
      "url": "https://en.wikipedia.org/wiki/Meet_the_Parents_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0090887": [
    {
      "name": "Зубастики",
      "url": "https://en.wikipedia.org/wiki/Critters_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0094919": [
    {
      "name": "Зубастики",
      "url": "https://en.wikipedia.org/wiki/Critters_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0101627": [
    {
      "name": "Зубастики",
      "url": "https://en.wikipedia.org/wiki/Critters_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808510": [
    {
      "name": "Зубная фея",
      "url": "https://en.wikipedia.org/wiki/Tooth_Fairy_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1935929": [
    {
      "name": "Зубная фея",
      "url": "https://en.wikipedia.org/wiki/Tooth_Fairy_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1670345": [
    {
      "name": "Иллюзия обмана",
      "url": "https://en.wikipedia.org/wiki/Now_You_See_Me_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3110958": [
    {
      "name": "Иллюзия обмана",
      "url": "https://en.wikipedia.org/wiki/Now_You_See_Me_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4712810": [
    {
      "name": "Иллюзия обмана",
      "url": "https://en.wikipedia.org/wiki/Now_You_See_Me_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0082971": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0087469": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0097576": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0367882": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1462764": [
    {
      "name": "Индиана Джонс",
      "url": "https://en.wikipedia.org/wiki/Indiana_Jones",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0987918": [
    {
      "name": "Ирония судьбы",
      "url": "https://en.wikipedia.org/wiki/The_Irony_of_Fate_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4154664": [
    {
      "name": "Капитан Марвел",
      "url": "https://en.wikipedia.org/wiki/The_Marvels",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1155076": [
    {
      "name": "Карате-пацан и Кобра Кай",
      "url": "https://en.wikipedia.org/wiki/The_Karate_Kid_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7221388": [
    {
      "name": "Карате-пацан и Кобра Кай",
      "url": "https://en.wikipedia.org/wiki/The_Karate_Kid_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0096684": [
    {
      "name": "Квантовый скачок",
      "url": "https://en.wikipedia.org/wiki/Quantum_Leap_%282022_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt17043230": [
    {
      "name": "Квантовый скачок",
      "url": "https://en.wikipedia.org/wiki/Quantum_Leap_%282022_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0837563": [
    {
      "name": "Кладбище домашних животных",
      "url": "https://en.wikipedia.org/wiki/Pet_Sematary%3A_Bloodlines",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2395695": [
    {
      "name": "Космос",
      "url": "https://en.wikipedia.org/wiki/Cosmos%3A_A_Spacetime_Odyssey",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0126029": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0298148": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0413267": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0892791": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0448694": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3915174": [
    {
      "name": "Шрек и Кот в сапогах",
      "url": "https://en.wikipedia.org/wiki/Shrek_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0123755": [
    {
      "name": "Куб",
      "url": "https://en.wikipedia.org/wiki/Cube_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0285492": [
    {
      "name": "Куб",
      "url": "https://en.wikipedia.org/wiki/Cube_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0377713": [
    {
      "name": "Куб",
      "url": "https://en.wikipedia.org/wiki/Cube_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2930610": [
    {
      "name": "Кухня",
      "url": "https://ru.wikipedia.org/wiki/%D0%9A%D1%83%D1%85%D0%BD%D1%8F_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6841500": [
    {
      "name": "Кухня",
      "url": "https://ru.wikipedia.org/wiki/%D0%9A%D1%83%D1%85%D0%BD%D1%8F_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0268380": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0438097": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1080016": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1667889": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3416828": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13634480": [
    {
      "name": "Ледниковый период",
      "url": "https://en.wikipedia.org/wiki/Ice_Age_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3758814": [
    {
      "name": "Ледяной драйв",
      "url": "https://en.wikipedia.org/wiki/Ice_Road%3A_Vengeance",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120903": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0290334": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0376994": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0458525": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1270798": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1430132": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1877832": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3385516": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3315342": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6565702": [
    {
      "name": "Люди Икс",
      "url": "https://en.wikipedia.org/wiki/X-Men_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0178725": [
    {
      "name": "Любить по-русски",
      "url": "https://ru.wikipedia.org/wiki/%D0%9B%D1%8E%D0%B1%D0%B8%D1%82%D1%8C_%D0%BF%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0127011": [
    {
      "name": "Любить по-русски",
      "url": "https://ru.wikipedia.org/wiki/%D0%9B%D1%8E%D0%B1%D0%B8%D1%82%D1%8C_%D0%BF%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0415952": [
    {
      "name": "Любить по-русски",
      "url": "https://ru.wikipedia.org/wiki/%D0%9B%D1%8E%D0%B1%D0%B8%D1%82%D1%8C_%D0%BF%D0%BE-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0119654": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120912": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1409024": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2283336": [
    {
      "name": "Люди в чёрном",
      "url": "https://en.wikipedia.org/wiki/Men_in_Black_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0351283": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0479952": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1277953": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1911658": [
    {
      "name": "Мадагаскар",
      "url": "https://en.wikipedia.org/wiki/Madagascar_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1587310": [
    {
      "name": "Малефисента",
      "url": "https://en.wikipedia.org/wiki/Maleficent%3A_Mistress_of_Evil",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1411697": [
    {
      "name": "Мальчишник",
      "url": "https://en.wikipedia.org/wiki/The_Hangover_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1951261": [
    {
      "name": "Мальчишник",
      "url": "https://en.wikipedia.org/wiki/The_Hangover_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0133093": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0234215": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0242653": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10838180": [
    {
      "name": "Матрица",
      "url": "https://en.wikipedia.org/wiki/The_Matrix_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0985694": [
    {
      "name": "Мачете",
      "url": "https://en.wikipedia.org/wiki/Machete_Kills",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2002718": [
    {
      "name": "Мачете",
      "url": "https://en.wikipedia.org/wiki/Machete_Kills",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1232829": [
    {
      "name": "Мачо и ботан",
      "url": "https://en.wikipedia.org/wiki/Jump_Street_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2294449": [
    {
      "name": "Мачо и ботан",
      "url": "https://en.wikipedia.org/wiki/Jump_Street_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4779682": [
    {
      "name": "Мег",
      "url": "https://en.wikipedia.org/wiki/Meg_2%3A_The_Trench",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9224104": [
    {
      "name": "Мег",
      "url": "https://en.wikipedia.org/wiki/Meg_2%3A_The_Trench",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3522806": [
    {
      "name": "Механик",
      "url": "https://en.wikipedia.org/wiki/Mechanic%3A_Resurrection",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0369610": [
    {
      "name": "Парк и Мир Юрского периода",
      "url": "https://en.wikipedia.org/wiki/Jurassic_Park",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4881806": [
    {
      "name": "Парк и Мир Юрского периода",
      "url": "https://en.wikipedia.org/wiki/Jurassic_Park",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8041270": [
    {
      "name": "Парк и Мир Юрского периода",
      "url": "https://en.wikipedia.org/wiki/Jurassic_Park",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0117060": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120755": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0317919": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1229238": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2381249": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4912910": [
    {
      "name": "Миссия невыполнима",
      "url": "https://en.wikipedia.org/wiki/Mission%3A_Impossible_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1408253": [
    {
      "name": "Совместная поездка",
      "url": "https://en.wikipedia.org/wiki/Ride_Along_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2869728": [
    {
      "name": "Совместная поездка",
      "url": "https://en.wikipedia.org/wiki/Ride_Along_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3717490": [
    {
      "name": "Могучие рейнджеры",
      "url": "https://en.wikipedia.org/wiki/Power_Rangers_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0848228": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2395427": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4154756": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4154796": [
    {
      "name": "Мстители",
      "url": "https://en.wikipedia.org/wiki/Avengers_%28Marvel_Cinematic_Universe%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt30612313": [
    {
      "name": "Мы из будущего",
      "url": "https://ru.wikipedia.org/wiki/%D0%9C%D1%8B_%D0%B8%D0%B7_%D0%B1%D1%83%D0%B4%D1%83%D1%89%D0%B5%D0%B3%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1590125": [
    {
      "name": "Мы из будущего",
      "url": "https://ru.wikipedia.org/wiki/%D0%9C%D1%8B_%D0%B8%D0%B7_%D0%B1%D1%83%D0%B4%D1%83%D1%89%D0%B5%D0%B3%D0%BE_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0088763": [
    {
      "name": "Назад в будущее",
      "url": "https://en.wikipedia.org/wiki/Back_to_the_Future_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0096874": [
    {
      "name": "Назад в будущее",
      "url": "https://en.wikipedia.org/wiki/Back_to_the_Future_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0099088": [
    {
      "name": "Назад в будущее",
      "url": "https://en.wikipedia.org/wiki/Back_to_the_Future_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0425061": [
    {
      "name": "Напряги извилины",
      "url": "https://en.wikipedia.org/wiki/Get_Smart_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3843168": [
    {
      "name": "Нация Z",
      "url": "https://en.wikipedia.org/wiki/Black_Summer_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0454848": [
    {
      "name": "Не пойман - не вор",
      "url": "https://en.wikipedia.org/wiki/Inside_Man%3A_Most_Wanted",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1499658": [
    {
      "name": "Несносные боссы",
      "url": "https://en.wikipedia.org/wiki/Horrible_Bosses_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2170439": [
    {
      "name": "Несносные боссы",
      "url": "https://en.wikipedia.org/wiki/Horrible_Bosses_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3063516": [
    {
      "name": "Чудаки",
      "url": "https://en.wikipedia.org/wiki/Jackass_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6237612": [
    {
      "name": "Несчастный случай",
      "url": "https://en.wikipedia.org/wiki/Accident_Man%3A_Hitman%27s_Holiday",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9669176": [
    {
      "name": "Несчастный случай",
      "url": "https://en.wikipedia.org/wiki/Accident_Man%3A_Hitman%27s_Holiday",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1320253": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1764651": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2333784": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3291150": [
    {
      "name": "Неудержимые",
      "url": "https://en.wikipedia.org/wiki/The_Expendables_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1820225": [
    {
      "name": "Сваты",
      "url": "https://ru.wikipedia.org/wiki/%D0%A1%D0%B2%D0%B0%D1%82%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1820565": [
    {
      "name": "Сваты",
      "url": "https://ru.wikipedia.org/wiki/%D0%A1%D0%B2%D0%B0%D1%82%D1%8B",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0948470": [
    {
      "name": "Новый Человек-паук",
      "url": "https://en.wikipedia.org/wiki/The_Amazing_Spider-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1872181": [
    {
      "name": "Новый Человек-паук",
      "url": "https://en.wikipedia.org/wiki/The_Amazing_Spider-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2692250": [
    {
      "name": "Ночь в музее",
      "url": "https://en.wikipedia.org/wiki/Night_at_the_Museum_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1219289": [
    {
      "name": "Области тьмы",
      "url": "https://en.wikipedia.org/wiki/Limitless_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4422836": [
    {
      "name": "Области тьмы",
      "url": "https://en.wikipedia.org/wiki/Limitless_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0099785": [
    {
      "name": "Один дома",
      "url": "https://en.wikipedia.org/wiki/Home_Alone_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0104431": [
    {
      "name": "Один дома",
      "url": "https://en.wikipedia.org/wiki/Home_Alone_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1375670": [
    {
      "name": "Одноклассники",
      "url": "https://en.wikipedia.org/wiki/Grown_Ups_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2191701": [
    {
      "name": "Одноклассники",
      "url": "https://en.wikipedia.org/wiki/Grown_Ups_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5526028": [
    {
      "name": "Одноклассницы",
      "url": "https://ru.wikipedia.org/wiki/%D0%9E%D0%B4%D0%BD%D0%BE%D0%BA%D0%BB%D0%B0%D1%81%D1%81%D0%BD%D0%B8%D1%86%D1%8B_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2016%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1396484": [
    {
      "name": "Оно",
      "url": "https://en.wikipedia.org/wiki/Welcome_to_Derry",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7349950": [
    {
      "name": "Оно",
      "url": "https://en.wikipedia.org/wiki/Welcome_to_Derry",
      "origin": "каталог кинотеки"
    }
  ],
  "tt19244304": [
    {
      "name": "Оно",
      "url": "https://en.wikipedia.org/wiki/Welcome_to_Derry",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1538403": [
    {
      "name": "Орудия смерти",
      "url": "https://en.wikipedia.org/wiki/The_Mortal_Instruments",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0181689": [
    {
      "name": "Особое мнение",
      "url": "https://en.wikipedia.org/wiki/Minority_Report_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4450826": [
    {
      "name": "Особое мнение",
      "url": "https://en.wikipedia.org/wiki/Minority_Report_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0175142": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0257106": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0306047": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0362120": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0795461": [
    {
      "name": "Очень страшное кино",
      "url": "https://en.wikipedia.org/wiki/Scary_Movie_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2302755": [
    {
      "name": "Падение Олимпа",
      "url": "https://en.wikipedia.org/wiki/Has_Fallen",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3300542": [
    {
      "name": "Падение Олимпа",
      "url": "https://en.wikipedia.org/wiki/Has_Fallen",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2548396": [
    {
      "name": "Кловерфилд",
      "url": "https://en.wikipedia.org/wiki/Cloverfield_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1190634": [
    {
      "name": "Пацаны",
      "url": "https://en.wikipedia.org/wiki/The_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13159924": [
    {
      "name": "Пацаны",
      "url": "https://en.wikipedia.org/wiki/The_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0458339": [
    {
      "name": "Первый мститель",
      "url": "https://en.wikipedia.org/wiki/Captain_America_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1843866": [
    {
      "name": "Первый мститель",
      "url": "https://en.wikipedia.org/wiki/Captain_America_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3498820": [
    {
      "name": "Первый мститель",
      "url": "https://en.wikipedia.org/wiki/Captain_America_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0293662": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0388482": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1129442": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1885102": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2938956": [
    {
      "name": "Перевозчик",
      "url": "https://en.wikipedia.org/wiki/Transporter_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1754738": [
    {
      "name": "Пипец",
      "url": "https://en.wikipedia.org/wiki/Kick-Ass_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1650554": [
    {
      "name": "Пипец",
      "url": "https://en.wikipedia.org/wiki/Kick-Ass_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0325980": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0383574": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0449088": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1298650": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1790809": [
    {
      "name": "Пираты Карибского моря",
      "url": "https://en.wikipedia.org/wiki/Pirates_of_the_Caribbean_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1211956": [
    {
      "name": "План побега",
      "url": "https://en.wikipedia.org/wiki/Escape_Plan_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6513656": [
    {
      "name": "План побега",
      "url": "https://en.wikipedia.org/wiki/Escape_Plan_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5491994": [
    {
      "name": "Планета Земля",
      "url": "https://en.wikipedia.org/wiki/Planet_Earth_II",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8228288": [
    {
      "name": "Платформа",
      "url": "https://en.wikipedia.org/wiki/The_Platform_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt27729779": [
    {
      "name": "Платформа",
      "url": "https://en.wikipedia.org/wiki/The_Platform_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0112442": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0172156": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1502397": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4919268": [
    {
      "name": "Плохие парни",
      "url": "https://en.wikipedia.org/wiki/Bad_Boys_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0307987": [
    {
      "name": "Плохой Санта",
      "url": "https://en.wikipedia.org/wiki/Bad_Santa_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1798603": [
    {
      "name": "Плохой Санта",
      "url": "https://en.wikipedia.org/wiki/Bad_Santa_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0455275": [
    {
      "name": "Побег",
      "url": "https://en.wikipedia.org/wiki/Prison_Break%3A_The_Final_Break",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1131748": [
    {
      "name": "Побег",
      "url": "https://en.wikipedia.org/wiki/Prison_Break%3A_The_Final_Break",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2906216": [
    {
      "name": "Подземелья и драконы",
      "url": "https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0094898": [
    {
      "name": "Поездка в Америку",
      "url": "https://en.wikipedia.org/wiki/Coming_2_America",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0086960": [
    {
      "name": "Полицейский из Беверли-Хиллз",
      "url": "https://en.wikipedia.org/wiki/Beverly_Hills_Cop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0092644": [
    {
      "name": "Полицейский из Беверли-Хиллз",
      "url": "https://en.wikipedia.org/wiki/Beverly_Hills_Cop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0109254": [
    {
      "name": "Полицейский из Беверли-Хиллз",
      "url": "https://en.wikipedia.org/wiki/Beverly_Hills_Cop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0808096": [
    {
      "name": "Портал юрского периода",
      "url": "https://en.wikipedia.org/wiki/Primeval%3A_New_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2295953": [
    {
      "name": "Портал юрского периода",
      "url": "https://en.wikipedia.org/wiki/Primeval%3A_New_World",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6175394": [
    {
      "name": "Последний богатырь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8C",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13606158": [
    {
      "name": "Последний богатырь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8C",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13769630": [
    {
      "name": "Последний богатырь",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9_%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D1%80%D1%8C",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0259324": [
    {
      "name": "Призрачный гонщик",
      "url": "https://en.wikipedia.org/wiki/Ghost_Rider%3A_Spirit_of_Vengeance",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1071875": [
    {
      "name": "Призрачный гонщик",
      "url": "https://en.wikipedia.org/wiki/Ghost_Rider%3A_Spirit_of_Vengeance",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0790736": [
    {
      "name": "Призрачный патруль",
      "url": "https://en.wikipedia.org/wiki/R.I.P.D._2%3A_Rise_of_the_Damned",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1109624": [
    {
      "name": "Паддингтон",
      "url": "https://en.wikipedia.org/wiki/Paddington_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0115320": [
    {
      "name": "Притворщик",
      "url": "https://en.wikipedia.org/wiki/The_Pretender_2001",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4731148": [
    {
      "name": "Притяжение",
      "url": "https://en.wikipedia.org/wiki/Invasion_%282020_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6284064": [
    {
      "name": "Притяжение",
      "url": "https://en.wikipedia.org/wiki/Invasion_%282020_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0108500": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120882": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0189192": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2441982": [
    {
      "name": "Пришельцы",
      "url": "https://en.wikipedia.org/wiki/Les_Visiteurs",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1446714": [
    {
      "name": "Чужой",
      "url": "https://en.wikipedia.org/wiki/Alien_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11947406": [
    {
      "name": "Простоквашино",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D1%80%D0%BE%D1%81%D1%82%D0%BE%D0%BA%D0%B2%D0%B0%D1%88%D0%B8%D0%BD%D0%BE_%28%D0%BC%D1%83%D0%BB%D1%8C%D1%82%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1397514": [
    {
      "name": "Путешествие к центру Земли",
      "url": "https://en.wikipedia.org/wiki/Journey_2%3A_The_Mysterious_Island",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1837341": [
    {
      "name": "Реальные пацаны",
      "url": "https://ru.wikipedia.org/wiki/%D0%A0%D0%B5%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%BF%D0%B0%D1%86%D0%B0%D0%BD%D1%8B_%D0%BF%D1%80%D0%BE%D1%82%D0%B8%D0%B2_%D0%B7%D0%BE%D0%BC%D0%B1%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13872708": [
    {
      "name": "Реальные пацаны",
      "url": "https://ru.wikipedia.org/wiki/%D0%A0%D0%B5%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D0%B5_%D0%BF%D0%B0%D1%86%D0%B0%D0%BD%D1%8B_%D0%BF%D1%80%D0%BE%D1%82%D0%B8%D0%B2_%D0%B7%D0%BE%D0%BC%D0%B1%D0%B8",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1899353": [
    {
      "name": "Рейд",
      "url": "https://en.wikipedia.org/wiki/The_Raid_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2265171": [
    {
      "name": "Рейд",
      "url": "https://en.wikipedia.org/wiki/The_Raid_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1234721": [
    {
      "name": "Робокоп",
      "url": "https://en.wikipedia.org/wiki/RoboCop_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2990140": [
    {
      "name": "Рождественские хроники",
      "url": "https://en.wikipedia.org/wiki/The_Christmas_Chronicles_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1245526": [
    {
      "name": "РЭД",
      "url": "https://en.wikipedia.org/wiki/Red_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1821694": [
    {
      "name": "РЭД",
      "url": "https://en.wikipedia.org/wiki/Red_2_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111070": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0304669": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0452681": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt17047510": [
    {
      "name": "Санта-Клаус",
      "url": "https://en.wikipedia.org/wiki/The_Santa_Clause_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1409069": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3752220": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt16233524": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3608112": [
    {
      "name": "Универ",
      "url": "https://ru.wikipedia.org/wiki/%D0%A3%D0%BD%D0%B8%D0%B2%D0%B5%D1%80_%28%D1%82%D0%B5%D0%BB%D0%B5%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0460681": [
    {
      "name": "Сверхъестественное",
      "url": "https://en.wikipedia.org/wiki/Supernatural_%28American_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt16431870": [
    {
      "name": "Семейный план",
      "url": "https://en.wikipedia.org/wiki/The_Family_Plan_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt34276058": [
    {
      "name": "Семейный план",
      "url": "https://en.wikipedia.org/wiki/The_Family_Plan_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0096697": [
    {
      "name": "Симпсоны",
      "url": "https://en.wikipedia.org/wiki/The_Simpsons_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1564585": [
    {
      "name": "Скайлайн",
      "url": "https://en.wikipedia.org/wiki/Skyline_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3102440": [
    {
      "name": "Скандинавский форсаж",
      "url": "https://en.wikipedia.org/wiki/B%C3%B8rning_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4956984": [
    {
      "name": "Скандинавский форсаж",
      "url": "https://en.wikipedia.org/wiki/B%C3%B8rning_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111257": [
    {
      "name": "Скорость",
      "url": "https://en.wikipedia.org/wiki/Speed_2%3A_Cruise_Control",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120179": [
    {
      "name": "Скорость",
      "url": "https://en.wikipedia.org/wiki/Speed_2%3A_Cruise_Control",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6235122": [
    {
      "name": "Слуга народа",
      "url": "https://en.wikipedia.org/wiki/Servant_of_the_People_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1842127": [
    {
      "name": "Смертельная битва",
      "url": "https://en.wikipedia.org/wiki/Mortal_Kombat%3A_Legacy",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0452608": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1500491": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1988591": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3807900": [
    {
      "name": "Смертельная гонка",
      "url": "https://en.wikipedia.org/wiki/Death_Race_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590190": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590264": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590236": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590252": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3590208": [
    {
      "name": "Смерть шпионам",
      "url": "https://www.kinopoisk.ru/series/737999/",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0368891": [
    {
      "name": "Сокровище нации",
      "url": "https://en.wikipedia.org/wiki/National_Treasure_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0465234": [
    {
      "name": "Сокровище нации",
      "url": "https://en.wikipedia.org/wiki/National_Treasure_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt12580982": [
    {
      "name": "Сокровище нации",
      "url": "https://en.wikipedia.org/wiki/National_Treasure_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3794354": [
    {
      "name": "Соник",
      "url": "https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt12412888": [
    {
      "name": "Соник",
      "url": "https://en.wikipedia.org/wiki/Sonic_the_Hedgehog_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2004420": [
    {
      "name": "Соседи",
      "url": "https://en.wikipedia.org/wiki/Neighbors_2%3A_Sorority_Rising",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1469304": [
    {
      "name": "Спасатели Малибу",
      "url": "https://en.wikipedia.org/wiki/Baywatch_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0166813": [
    {
      "name": "Спирит",
      "url": "https://en.wikipedia.org/wiki/Spirit_Untamed",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2113681": [
    {
      "name": "Столетний старик",
      "url": "https://en.wikipedia.org/wiki/The_101-Year-Old_Man_Who_Skipped_Out_on_the_Bill_and_Disappeared",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2015381": [
    {
      "name": "Стражи Галактики",
      "url": "https://en.wikipedia.org/wiki/Guardians_of_the_Galaxy_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0113492": [
    {
      "name": "Судья Дредд",
      "url": "https://en.wikipedia.org/wiki/Dredd",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1343727": [
    {
      "name": "Судья Дредд",
      "url": "https://en.wikipedia.org/wiki/Dredd",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5308322": [
    {
      "name": "Счастливого дня смерти",
      "url": "https://en.wikipedia.org/wiki/Happy_Death_Day_2U",
      "origin": "каталог кинотеки"
    }
  ],
  "tt8155288": [
    {
      "name": "Счастливого дня смерти",
      "url": "https://en.wikipedia.org/wiki/Happy_Death_Day_2U",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2418558": [
    {
      "name": "Таймлесс",
      "url": "https://en.wikipedia.org/wiki/Ruby_Red_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3260022": [
    {
      "name": "Таймлесс",
      "url": "https://en.wikipedia.org/wiki/Ruby_Red_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4960934": [
    {
      "name": "Таймлесс",
      "url": "https://en.wikipedia.org/wiki/Ruby_Red_%28film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6218010": [
    {
      "name": "Вий",
      "url": "https://en.wikipedia.org/wiki/Viy_2%3A_Journey_to_China",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2709768": [
    {
      "name": "Тайная жизнь домашних животных",
      "url": "https://en.wikipedia.org/wiki/The_Secret_Life_of_Pets_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7238392": [
    {
      "name": "Такси",
      "url": "https://en.wikipedia.org/wiki/Taxi_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1959563": [
    {
      "name": "Телохранитель киллера",
      "url": "https://en.wikipedia.org/wiki/Hitman%27s_Wife%27s_Bodyguard",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0088247": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0103064": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0181852": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0438488": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1340138": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6450804": [
    {
      "name": "Терминатор",
      "url": "https://en.wikipedia.org/wiki/Terminator_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1663662": [
    {
      "name": "Тихоокеанский рубеж",
      "url": "https://en.wikipedia.org/wiki/Pacific_Rim_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0800369": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1981115": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3501632": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10648342": [
    {
      "name": "Тор",
      "url": "https://en.wikipedia.org/wiki/Thor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1637725": [
    {
      "name": "Третий лишний",
      "url": "https://en.wikipedia.org/wiki/Ted_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2637276": [
    {
      "name": "Третий лишний",
      "url": "https://en.wikipedia.org/wiki/Ted_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0295701": [
    {
      "name": "Три икса",
      "url": "https://en.wikipedia.org/wiki/XXX_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0329774": [
    {
      "name": "Три икса",
      "url": "https://en.wikipedia.org/wiki/XXX_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1293847": [
    {
      "name": "Три икса",
      "url": "https://en.wikipedia.org/wiki/XXX_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11116912": [
    {
      "name": "Тролль",
      "url": "https://en.wikipedia.org/wiki/Troll_2_%282025_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0084827": [
    {
      "name": "Трон",
      "url": "https://en.wikipedia.org/wiki/Tron_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1104001": [
    {
      "name": "Трон",
      "url": "https://en.wikipedia.org/wiki/Tron_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2720566": [
    {
      "name": "Туман",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%83%D0%BC%D0%B0%D0%BD_%28%D1%84%D0%B8%D0%BB%D1%8C%D0%BC%2C_2010%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0109686": [
    {
      "name": "Тупой и ещё тупее",
      "url": "https://en.wikipedia.org/wiki/Dumb_and_Dumber_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2096672": [
    {
      "name": "Тупой и ещё тупее",
      "url": "https://en.wikipedia.org/wiki/Dumb_and_Dumber_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1860353": [
    {
      "name": "Турбо",
      "url": "https://en.wikipedia.org/wiki/Turbo_Fast",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3713166": [
    {
      "name": "Убрать из друзей",
      "url": "https://en.wikipedia.org/wiki/Unfriended%3A_Dark_Web",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111999": [
    {
      "name": "Геракл",
      "url": "https://en.wikipedia.org/wiki/Hercules%3A_The_Legendary_Journeys",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0095631": [
    {
      "name": "Успеть до полуночи",
      "url": "https://en.wikipedia.org/wiki/Midnight_Run_for_Your_Life",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0092345": [
    {
      "name": "Утиные истории",
      "url": "https://en.wikipedia.org/wiki/DuckTales_%281987_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120667": [
    {
      "name": "Фантастическая четвёрка",
      "url": "https://en.wikipedia.org/wiki/Fantastic_Four_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0486576": [
    {
      "name": "Фантастическая четвёрка",
      "url": "https://en.wikipedia.org/wiki/Fantastic_Four_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1502712": [
    {
      "name": "Фантастическая четвёрка",
      "url": "https://en.wikipedia.org/wiki/Fantastic_Four_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0111964": [
    {
      "name": "Флиппер",
      "url": "https://en.wikipedia.org/wiki/Flipper_%281996_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3107288": [
    {
      "name": "Вселенная Стрелы",
      "url": "https://en.wikipedia.org/wiki/Arrowverse",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1596343": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1905041": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2820852": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4630562": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6806448": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5433138": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5433140": [
    {
      "name": "Форсаж",
      "url": "https://en.wikipedia.org/wiki/Fast_%26_Furious",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0167190": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0411477": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2274648": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt26757462": [
    {
      "name": "Хеллбой",
      "url": "https://en.wikipedia.org/wiki/Hellboy%3A_The_Crooked_Man",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0465494": [
    {
      "name": "Хитмэн",
      "url": "https://en.wikipedia.org/wiki/Hitman%3A_Agent_47",
      "origin": "каталог кинотеки"
    }
  ],
  "tt11418452": [
    {
      "name": "Холоп",
      "url": "https://ru.wikipedia.org/wiki/%D0%A5%D0%BE%D0%BB%D0%BE%D0%BF_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt20721318": [
    {
      "name": "Холоп",
      "url": "https://ru.wikipedia.org/wiki/%D0%A5%D0%BE%D0%BB%D0%BE%D0%BF_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0134847": [
    {
      "name": "Риддик",
      "url": "https://en.wikipedia.org/wiki/The_Chronicles_of_Riddick_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0296572": [
    {
      "name": "Риддик",
      "url": "https://en.wikipedia.org/wiki/The_Chronicles_of_Riddick_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2121377": [
    {
      "name": "Хулиган с белым воротничком",
      "url": "https://www.screendaily.com/production/white-collar-hooligan-2-to-kick-off-in-spain-momentum-boards-uk/5044640.article",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0120812": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0266915": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0293564": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4085584": [
    {
      "name": "Час пик",
      "url": "https://en.wikipedia.org/wiki/Rush_Hour_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0756683": [
    {
      "name": "Человек с Земли",
      "url": "https://en.wikipedia.org/wiki/The_Man_from_Earth%3A_Holocene",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0478970": [
    {
      "name": "Человек-муравей",
      "url": "https://en.wikipedia.org/wiki/Ant-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5095030": [
    {
      "name": "Человек-муравей",
      "url": "https://en.wikipedia.org/wiki/Ant-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10954600": [
    {
      "name": "Человек-муравей",
      "url": "https://en.wikipedia.org/wiki/Ant-Man_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2250912": [
    {
      "name": "Человек-паук - MCU",
      "url": "https://en.wikipedia.org/wiki/Spider-Man%3A_Homecoming",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6320628": [
    {
      "name": "Человек-паук - MCU",
      "url": "https://en.wikipedia.org/wiki/Spider-Man%3A_Homecoming",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10872600": [
    {
      "name": "Человек-паук - MCU",
      "url": "https://en.wikipedia.org/wiki/Spider-Man%3A_Homecoming",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1291150": [
    {
      "name": "Черепашки-ниндзя",
      "url": "https://en.wikipedia.org/wiki/Teenage_Mutant_Ninja_Turtles_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3949660": [
    {
      "name": "Черепашки-ниндзя",
      "url": "https://en.wikipedia.org/wiki/Teenage_Mutant_Ninja_Turtles_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1825683": [
    {
      "name": "Чёрная пантера",
      "url": "https://en.wikipedia.org/wiki/Black_Panther%3A_Wakanda_Forever",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9114286": [
    {
      "name": "Чёрная пантера",
      "url": "https://en.wikipedia.org/wiki/Black_Panther%3A_Wakanda_Forever",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1390932": [
    {
      "name": "Четыре таксиста и собака",
      "url": "https://ru.wikipedia.org/wiki/%D0%A7%D0%B5%D1%82%D1%8B%D1%80%D0%B5_%D1%82%D0%B0%D0%BA%D1%81%D0%B8%D1%81%D1%82%D0%B0_%D0%B8_%D1%81%D0%BE%D0%B1%D0%B0%D0%BA%D0%B0",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0117218": [
    {
      "name": "Чокнутый профессор",
      "url": "https://en.wikipedia.org/wiki/The_Nutty_Professor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0144528": [
    {
      "name": "Чокнутый профессор",
      "url": "https://en.wikipedia.org/wiki/The_Nutty_Professor_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0108988": [
    {
      "name": "Чудеса науки",
      "url": "https://en.wikipedia.org/wiki/Weird_Science_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0451279": [
    {
      "name": "Чудо-женщина",
      "url": "https://en.wikipedia.org/wiki/Wonder_Woman_1984",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2741602": [
    {
      "name": "Чёрный список",
      "url": "https://en.wikipedia.org/wiki/The_Blacklist%3A_Redemption",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0448115": [
    {
      "name": "Шазам",
      "url": "https://en.wikipedia.org/wiki/Shazam%21_Fury_of_the_Gods",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6443346": [
    {
      "name": "Шазам",
      "url": "https://en.wikipedia.org/wiki/Shazam%21_Fury_of_the_Gods",
      "origin": "каталог кинотеки"
    }
  ],
  "tt10456740": [
    {
      "name": "Шальная пуля",
      "url": "https://en.wikipedia.org/wiki/Lost_Bullet_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt14465706": [
    {
      "name": "Шальная пуля",
      "url": "https://en.wikipedia.org/wiki/Lost_Bullet_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1475582": [
    {
      "name": "Шерлок Холмс",
      "url": "https://en.wikipedia.org/wiki/Sherlock_Holmes_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0988045": [
    {
      "name": "Шерлок Холмс",
      "url": "https://en.wikipedia.org/wiki/Sherlock_Holmes_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1515091": [
    {
      "name": "Шерлок Холмс",
      "url": "https://en.wikipedia.org/wiki/Sherlock_Holmes_in_film",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1937133": [
    {
      "name": "Шутки в сторону",
      "url": "https://en.wikipedia.org/wiki/The_Takedown",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0289879": [
    {
      "name": "Эффект бабочки",
      "url": "https://en.wikipedia.org/wiki/The_Butterfly_Effect_2",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4189022": [
    {
      "name": "Зловещие мертвецы",
      "url": "https://en.wikipedia.org/wiki/Evil_Dead",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1712170": [
    {
      "name": "Алекс Кросс",
      "url": "https://en.wikipedia.org/wiki/Alex_Cross_%28film_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5519340": [
    {
      "name": "Яркость",
      "url": "https://en.wikipedia.org/wiki/Bright%3A_Samurai_Soul",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1782568": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2124096": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3121434": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt3877844": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5840988": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt6907804": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt9615680": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt16148580": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt22059202": [
    {
      "name": "Ёлки",
      "url": "https://en.wikipedia.org/wiki/Yolki",
      "origin": "каталог кинотеки"
    }
  ],
  "tt37660303": [
    {
      "name": "Шекер",
      "url": "https://ru.wikipedia.org/wiki/%D0%A8%D0%B5%D0%BA%D0%B5%D1%80_%28%D1%81%D0%B5%D1%80%D0%B8%D0%B0%D0%BB%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0100802": [
    {
      "name": "Вспомнить всё",
      "url": "https://en.wikipedia.org/wiki/Total_Recall_%281990_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1386703": [
    {
      "name": "Вспомнить всё",
      "url": "https://en.wikipedia.org/wiki/Total_Recall_%281990_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0365748": [
    {
      "name": "Трилогия Корнетто",
      "url": "https://en.wikipedia.org/wiki/Three_Flavours_Cornetto",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0060584": [
    {
      "name": "Приключения Шурика",
      "url": "https://ru.wikipedia.org/wiki/%D0%A8%D1%83%D1%80%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0070233": [
    {
      "name": "Приключения Шурика",
      "url": "https://ru.wikipedia.org/wiki/%D0%A8%D1%83%D1%80%D0%B8%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0055400": [
    {
      "name": "Трус, Балбес и Бывалый",
      "url": "https://ru.wikipedia.org/wiki/%D0%A2%D1%80%D1%83%D1%81%2C_%D0%91%D0%B0%D0%BB%D0%B1%D0%B5%D1%81_%D0%B8_%D0%91%D1%8B%D0%B2%D0%B0%D0%BB%D1%8B%D0%B9",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0077594": [
    {
      "name": "Игра смерти",
      "url": "https://en.wikipedia.org/wiki/Game_of_Death_II",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0475784": [
    {
      "name": "Мир Дикого Запада",
      "url": "https://en.wikipedia.org/wiki/Westworld_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0452046": [
    {
      "name": "Мыслить как преступник",
      "url": "https://en.wikipedia.org/wiki/Criminal_Minds_%28franchise%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt7587890": [
    {
      "name": "Новичок",
      "url": "https://en.wikipedia.org/wiki/The_Rookie%3A_Feds",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0407456": [
    {
      "name": "Участок",
      "url": "https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%BA%D0%BE%D0%BB%D0%B4%D0%BE%D0%B2%D0%B0%D0%BD%D0%BD%D1%8B%D0%B9_%D1%83%D1%87%D0%B0%D1%81%D1%82%D0%BE%D0%BA",
      "origin": "каталог кинотеки"
    }
  ],
  "tt4574604": [
    {
      "name": "Училка",
      "url": "https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B5%D0%B5_%D0%B8%D1%81%D0%BF%D1%8B%D1%82%D0%B0%D0%BD%D0%B8%D0%B5",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1706620": [
    {
      "name": "Сквозь снег",
      "url": "https://en.wikipedia.org/wiki/Snowpiercer_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0822854": [
    {
      "name": "Стрелок",
      "url": "https://en.wikipedia.org/wiki/Shooter_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt13802014": [
    {
      "name": "Небесный суд",
      "url": "https://ru.wikipedia.org/wiki/%D0%9D%D0%B5%D0%B1%D0%B5%D1%81%D0%BD%D1%8B%D0%B9_%D1%81%D1%83%D0%B4",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2303367": [
    {
      "name": "Дирк Джентли",
      "url": "https://en.wikipedia.org/wiki/Dirk_Gently%27s_Holistic_Detective_Agency_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt5076054": [
    {
      "name": "Старики-разведчики",
      "url": "https://www.bild.de/service/regio/kundschafter-des-friedens-2-ruestige-ex-spione-mischen-kuba-auf-6790f2a780e66176bf9c2c07",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0139654": [
    {
      "name": "Тренировочный день",
      "url": "https://en.wikipedia.org/wiki/Training_Day_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt2085059": [
    {
      "name": "Чёрное зеркало",
      "url": "https://en.wikipedia.org/wiki/Black_Mirror%3A_Bandersnatch",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0251075": [
    {
      "name": "Эволюция",
      "url": "https://en.wikipedia.org/wiki/Alienators%3A_Evolution_Continues",
      "origin": "каталог кинотеки"
    }
  ],
  "tt1182345": [
    {
      "name": "Луна 2112",
      "url": "https://en.wikipedia.org/wiki/Mute_%282018_film%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0356910": [
    {
      "name": "Мистер и миссис Смит",
      "url": "https://en.wikipedia.org/wiki/Mr._%26_Mrs._Smith_%282024_TV_series%29",
      "origin": "каталог кинотеки"
    }
  ],
  "tt0305224": [
    {
      "name": "Управление гневом",
      "url": "https://en.wikipedia.org/wiki/Anger_Management_%28TV_series%29",
      "origin": "каталог кинотеки"
    }
  ]
};

// Ожидаем только НОВУЮ карточку выбранного фильма, которую создаёт старый Template.
// Никаких изменений существующих фильмов и самого шаблона.
const pendingImports = new WeakMap();
function watchTemplate(params, movie, title, description, franchise, progress, kinopoiskId, people) {
    const {app, obsidian:ob} = params;
    pendingImports.get(app)?.();
    const previousFiles = new Set(app.vault.getMarkdownFiles());
    const created = new Set();
    const timers = new Map();
    const refs = [];
    let finished = false;
    let processing = false;
    let expiry;
    function cleanup() {
        finished = true;
        clearTimeout(expiry);
        timers.forEach(clearTimeout);
        refs.forEach(ref => app.vault.offref(ref));
        if (pendingImports.get(app) === cleanup) pendingImports.delete(app);
        progress?.hide?.();
    }
    async function finish(file) {
        if (finished || processing || !created.has(file)) return;
        processing = true;
        progress?.setMessage?.("Кино: шаблон создан, проверяю карточку…");
        try {
            const original = await app.vault.read(file);
            const replacement = patchTemplate(original, ob, movie.imdbID, description, franchise,
                normalizeRelease(movie.Released), kinopoiskId, people);
            if (replacement === null) return;
            // Перепроверяем путь: исходный файл обязан находиться среди созданных этим ожиданием.
            if (app.vault.getAbstractFileByPath(file.path) !== file) return;
            if (franchise.path) await ensureFranchise(app, ob, franchise, movie.imdbID);
            let applied = false;
            await app.vault.process(file, text => {
                if (text !== original) return text;
                applied = true;
                return replacement;
            });
            if (!applied) { schedule(file); return; }
            // Template мог использовать Title, а не fileName: исправляем имя после записи.
            if (file.basename !== title) {
                const folder = file.path.slice(0,file.path.lastIndexOf('/'));
                const candidates = [title, `${title} (${safeName(movie.Year)})`, `${title} (${movie.imdbID})`];
                const used = new Set(app.vault.getMarkdownFiles().filter(x=>x!==file).map(x=>x.path.toLowerCase()));
                for (const candidate of candidates) {
                    const path = `${folder}/${candidate}.md`;
                    if (!used.has(path.toLowerCase()) && !app.vault.getAbstractFileByPath(path)) {
                        await app.fileManager.renameFile(file,path);
                        break;
                    }
                }
            }
            // Люди и роли живут в отдельной служебной карточке. Путь строится
            // после переименования: если имя пришлось изменить из-за конфликта,
            // основная карточка и файл ролей всё равно останутся связаны.
            const rolePath = roleFilePath(file);
            await writeRoleFile(app, ob, file, movie, kinopoiskId, people);
            let roleEmbedApplied = false;
            await app.vault.process(file, text => {
                let next = ensureRoleEmbed(text, rolePath);
                next = ensureRecommendationButton(next);
                roleEmbedApplied = next !== text;
                return next;
            });
            progress?.setMessage?.("Кино: карточка добавлена.");
            cleanup();
            queueFranchise(params,movie,file);
        } catch (error) {
            // Карточка уже создана шаблоном. Не запускаем бесконечные записи.
            cleanup();
            new ob.Notice("Шаблон создан, но заполнение карточки/файла ролей не завершено: " + String(error?.message || error) + ". Запусти проверку кинотеки.", 12000);
        } finally { processing = false; }
    }
    function schedule(file) {
        if (finished || !created.has(file)) return;
        clearTimeout(timers.get(file));
        timers.set(file,setTimeout(()=>{ timers.delete(file); void finish(file); },750));
    }
    refs.push(app.vault.on('create',file=>{
        if (previousFiles.has(file) || file.extension !== 'md' || !file.path.startsWith(ROOT+'/') ||
            /\/(Просмотры|Сезоны|Франшизы|Служебное|_system)\//.test(file.path)) return;
        created.add(file); schedule(file);
    }));
    refs.push(app.vault.on('modify',schedule));
    refs.push(app.vault.on('rename',schedule));
    expiry = setTimeout(cleanup,30*60*1000);
    pendingImports.set(app,cleanup);
    return cleanup;
}

function patchTemplate(raw, ob, id, description, franchise, releaseDate, kinopoiskId, people = {}) {
    const match = raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) return null;
    let yaml = match[2];
    // Проверяем IMDb до разбора YAML: старый неэкранированный Plot мог содержать двоеточия.
    const imdb = yaml.match(/^(?:imdb Id|"imdb Id"|'imdb Id'):\s*["']?(tt\d+)["']?\s*(?:#.*)?$/m);
    if (!imdb || imdb[1] !== id) return null;
    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    function set(key,value) {
        const expression = yamlFieldExpression(key);
        const line = `${key}: ${JSON.stringify(value)}`;
        yaml = expression.test(yaml) ? yaml.replace(expression,()=>line) : yaml.trimEnd()+newline+line;
    }
    function setList(key, values) {
        const expression = yamlFieldExpression(key);
        const items = [...new Set((values || []).map(sourcePersonName).filter(Boolean))].sort(comparePeopleValues);
        const replacement = `${key}: ${yamlArray(items)}`;
        yaml = expression.test(yaml) ? yaml.replace(expression, () => replacement)
            : yaml.trimEnd() + newline + replacement;
    }
    function removeField(key) {
        yaml = yaml.replace(yamlFieldExpression(key), "");
    }
    set('Описание',description);
    // Актеры и роли больше не раздувают основную карточку: они записываются
    // в Кино/_system/Роли/<карточка>.роли.md после переименования файла.
    removeField('Актеры');
    removeField('Роли актеров');
    if (Array.isArray(people.directorNames)) setList('Режисер', people.directorNames);
    if (/^\d{1,12}$/.test(String(kinopoiskId || ""))) set('Кинопоиск ID', String(kinopoiskId));
    let fm;
    try { fm=ob.parseYaml(yaml); } catch { return null; }
    if (String(fm?.['imdb Id']) !== id) return null;
    if (releaseDate !== undefined || Object.prototype.hasOwnProperty.call(fm, 'Релиз')) {
        set('Релиз', normalizeRelease(fm['Релиз']) || normalizeRelease(releaseDate));
    }
    if (franchise.path && !fm['Франшиза']) {
        set('Франшиза',`[[${franchise.path.replace(/\.md$/,'')}]]`);
        if (franchise.part != null && fm['Часть'] == null) set('Часть',franchise.part);
    }
    return migrateEntities(match[1]+yaml+match[3]+raw.slice(match[0].length), ob);
}

const SERIES_ALIASES = {
  "Друзья Оушена": [
    "Оушен",
    "Оушены"
  ],
  "Расширенная вселенная DC": [
    "DCEU"
  ],
  "Киновселенная Marvel": [
    "MCU",
    "Кинематографическая вселенная Marvel"
  ],
  "Средиземье": [
    "Властелин колец"
  ],
  "Гадкий я и Миньоны": [
    "Гадкий я"
  ],
  "Волшебный мир Гарри Поттера": [
    "Гарри Поттер",
    "Волшебный мир"
  ],
  "Джейсон Борн": [
    "Борн"
  ],
  "Шрек и Кот в сапогах": [
    "Шрек"
  ],
  "Мальчишник": [
    "Мальчишник в Вегасе"
  ],
  "Парк и Мир Юрского периода": [
    "Парк Юрского периода",
    "Юрский период"
  ]
};


const franchiseJobs = new WeakMap();
function queueFranchise(params,movie,file) {
    const previous=franchiseJobs.get(params.app)||Promise.resolve();
    const job=previous.catch(()=>{}).then(async()=>{
        try {
            await afterTemplateFranchise(params,movie,file);
        } catch (_) {
            new params.obsidian.Notice('Карточка сохранена. Франшизу можно назначить отдельной командой. Затем запусти Кино - Проверить кинотеку.');
        }
        // Прогноз считаем уже для готовой карточки. Если пользователь выбрал франшизу,
        // она тоже попадет в признаки модели. Если пропустил - прогноз все равно будет.
        await runRatingForecast(params,file);
    });
    franchiseJobs.set(params.app,job);
    return job;
}

async function runRatingForecast(params,file) {
    const {app,obsidian:ob}=params;
    if (!file || app.vault.getAbstractFileByPath(file.path)!==file) return;
    try {
        let predictor=null;

        // На настольном Obsidian сначала пробуем обычный CommonJS require.
        // Это быстрее и использует тот же файл, что и отдельная команда прогноза.
        try {
            if (typeof require === 'function' && typeof app.vault.adapter?.getFullPath === 'function') {
                const fullPath=app.vault.adapter.getFullPath(RATING_PREDICTOR);
                try {
                    const resolved=require.resolve(fullPath);
                    if (require.cache?.[resolved]) delete require.cache[resolved];
                } catch (_) {}
                predictor=require(fullPath);
            }
        } catch (_) { predictor=null; }

        // Запасной вариант: читаем тот же QuickAdd-скрипт из vault и выполняем
        // как CommonJS-модуль. В predict_rating.js нет внешних require.
        if (typeof predictor !== 'function') {
            const scriptFile=app.vault.getAbstractFileByPath(RATING_PREDICTOR);
            if (!scriptFile) throw new Error('не найден ' + RATING_PREDICTOR);
            const source=await app.vault.read(scriptFile);
            const mod={exports:{}};
            const load=new Function('module','exports',source);
            load(mod,mod.exports);
            predictor=mod.exports;
        }
        if (typeof predictor !== 'function') throw new Error('скрипт прогноза не экспортирует функцию');

        const result=await predictor({...params,targetFile:file,suppressNotice:true});
        if (result && Number.isFinite(Number(result.prediction))) {
            const ml=result.movielens===null || result.movielens===undefined ? 'без MovieLens' : `MovieLens ${Number(result.movielens).toFixed(1)}`;
            new ob.Notice(`Карточка добавлена. Прогноз: ${Number(result.prediction).toFixed(1)}/10, ${result.confidence || 'уверенность не определена'}, ${ml}.`,9000);
        } else {
            new ob.Notice('Карточка добавлена. Прогноз не рассчитан - проверь, что в базе достаточно твоих оценок.',9000);
        }
    } catch (error) {
        console.error('Kino rating forecast after add:', error);
        new ob.Notice('Карточка добавлена, но прогноз не рассчитан: ' + String(error?.message || error),12000);
    }
}

async function afterTemplateFranchise(params,movie,file) {
    const {app,obsidian:ob,quickAddApi:qa}=params;
    if(app.vault.getAbstractFileByPath(file.path)!==file)return;
    const before=await frontmatter(app,ob,file);
    if(before['imdb Id']!==movie.imdbID || before['Франшиза'])return;
    await app.workspace.getLeaf(false).openFile(file);
    const notice=new ob.Notice('Карточка создана. Проверяю франшизу…',0);
    let result;
    try { result=await lookupFranchise(ob,movie.imdbID); }
    finally { notice.hide?.(); }
    const {pages,proposals}=await franchiseInventory(app,ob,result.suggestions);
    const choice=await franchiseDialog(app,ob,file.basename,pages,proposals,result.status);
    if(!choice)return;
    let part;
    while(true) {
        const value=await qa.inputPrompt('Номер части','Пусто - без номера');
        if(value==null)return;
        if(!value.trim()){part=null;break;}
        const n=Number(value.replace(',','.'));
        if(Number.isFinite(n)&&n>0){part=n;break;}
    }
    // Пока открыт диалог, пользователь может поменять карточку вручную.
    const current=await frontmatter(app,ob,file);
    if(current['imdb Id']!==movie.imdbID || current['Франшиза'])return;
    choice.part=part;
    await ensureFranchise(app,ob,choice,movie.imdbID);
    await app.fileManager.processFrontMatter(file,fm=>{
        if(fm['imdb Id']!==movie.imdbID || fm['Франшиза'])return;
        fm['Франшиза']=`[[${choice.path.replace(/\.md$/,'')}]]`;
        if(part!=null && fm['Часть']==null)fm['Часть']=part;
    });
}

async function lookupFranchise(ob,id) {
    // Отдельный запрос ПОСЛЕ создания карточки. Старый каталог его не отменяет.
    const query=`SELECT DISTINCT ?item ?series ?seriesLabel WHERE {
      ?item wdt:P345 "${id}" .
      OPTIONAL {
        { ?item wdt:P179 ?series } UNION { ?item wdt:P8345 ?series }
        FILTER NOT EXISTS { ?series wdt:P31 wd:Q13406463 }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en" . }
    } LIMIT 100`;
    const data=await getJson(ob,'https://query.wikidata.org/sparql',{format:'json',query});
    const parsed=parseWikidata(data);
    const direct=parsed.series.filter(s=>! /^(список |перечень |list of |filmography)/i.test(s.name)).map(s=>({...s,url:s.url.replace("#P179", "")}));
    // Локально проверенные связи показываются с отдельной пометкой, не как ответ интернета.
    const known=CATALOG[id]||[];
    const suggestions=[...direct,...known.filter(k=>!direct.some(d=>normalized(d.name)===normalized(k.name)))];
    return {suggestions,status:direct.length?'В интернете найдены связи с сериями. Выбери нужную.':
        known.length?'В интернете явная связь не найдена. Есть подсказки из ранее проверенного каталога.':
        'Принадлежность к франшизе не подтверждена. Это не означает, что продолжений нет. Можно выбрать вручную или пропустить.'};
}

function franchiseRef(value) {
    return String(value?.path||value||'').trim().replace(/^\[\[/,'').replace(/\]\]$/,'').split('|')[0].split('#')[0].replace(/\.md$/,'').trim();
}
function alphabetical(a,b) {
    return a.name.localeCompare(b.name,'ru',{sensitivity:'base',numeric:true})||a.path.localeCompare(b.path,'ru');
}
async function franchiseInventory(app,ob,suggestions) {
    const entries=[];
    for(const file of app.vault.getMarkdownFiles())entries.push({file,fm:await frontmatter(app,ob,file)});
    const pages=new Map();
    const add=(file,fm={},missing=false)=>{
        if(fm['imdb Id']||fm['Фильм']||fm['Сериал'])return;
        if(!pages.has(file.path))pages.set(file.path,{name:file.basename,path:file.path,fm,missing});
    };
    for(const {file,fm} of entries) {
        const tags=(Array.isArray(fm.tags)?fm.tags:[fm.tags]).map(x=>String(x||'').replace(/^#/,''));
        // Каталог франшиз может находиться вне Кино/ и иметь вложенные папки.
        if(file.path.split('/').slice(0,-1).some(x=>/^(франшизы|franchises)$/i.test(x)) || tags.includes('franchise'))add(file,fm);
    }
    const memberships=[];
    for(const {file,fm} of entries) {
        const refs=Array.isArray(fm['Франшиза'])?fm['Франшиза']:[fm['Франшиза']];
        for(const ref of refs.filter(Boolean)) {
            const path=franchiseRef(ref);
            if(!path)continue;
            const target=app.metadataCache.getFirstLinkpathDest(path,file.path);
            if(target?.extension==='md') {
                add(target,entries.find(x=>x.file.path===target.path)?.fm||{});
                memberships.push({id:fm['imdb Id'],path:target.path});
            } else {
                const dest=(path.includes('/')?path:`${SERIES}/${safeName(path)}`)+'.md';
                add({path:dest,basename:path.split('/').pop()},{},true);
                memberships.push({id:fm['imdb Id'],path:dest});
            }
        }
    }
    const list=[...pages.values()].sort(alphabetical);
    const proposals=[];
    for(const suggestion of suggestions) {
        const names=new Set([suggestion.name,...(SERIES_ALIASES[suggestion.name]||[])].map(normalized));
        const matches=list.filter(p=>{
            const aliases=Array.isArray(p.fm.aliases)?p.fm.aliases:[p.fm.aliases];
            return [p.name,...aliases.filter(Boolean)].some(x=>names.has(normalized(x))) ||
                memberships.some(m=>m.path===p.path&&(CATALOG[m.id]||[]).some(x=>names.has(normalized(x.name))));
        });
        if(matches.length)proposals.push(...matches.map(p=>({...suggestion,name:p.name,path:p.path})));
        else proposals.push({...suggestion,create:true});
    }
    return {pages:list,proposals};
}

function franchiseDialog(app,ob,title,pages,proposals,status) {
    return new Promise(resolve=>{
        class Picker extends ob.Modal {
            constructor(){super(app);this.result=null;}
            onOpen(){
                const el=this.contentEl;
                el.createEl('h2',{text:`Франшиза: ${title}`});
                el.createEl('p',{text:status});
                for(const p of proposals) {
                    const line=el.createEl('div');
                    line.createEl('span',{text:p.path?`Подходит существующая: ${p.name} `:`Предложенное название: ${p.name} `});
                    if(p.url)line.createEl('a',{text:'Источник',href:p.url,attr:{target:'_blank',rel:'noopener'}});
                }
                el.createEl('p',{text:'Название новой франшизы (можно изменить):'});
                const name=el.createEl('input',{type:'text'});
                name.style.width='100%';name.value=proposals.find(x=>!x.path)?.name||proposals[0]?.name||'';
                const create=el.createEl('button',{text:'Создать с этим названием'});
                create.onclick=()=>{
                    const value=safeName(name.value);
                    if(!value){name.focus();return;}
                    const existing=pages.filter(p=>normalized(p.name)===normalized(value));
                    if(existing.length===1){this.select(existing[0]);return;}
                    if(existing.length>1){search.value=value;render();return;}
                    const proposed=proposals.find(p=>normalized(p.name)===normalized(value));
                    this.select({...proposed,name:value,path:`${SERIES}/${value}.md`});
                };
                el.createEl('h3',{text:`Все существующие франшизы (${pages.length}), А–Я`});
                const search=el.createEl('input',{type:'search',placeholder:'Поиск по списку'});search.style.width='100%';
                const list=el.createEl('div');Object.assign(list.style,{maxHeight:'35vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:'4px',marginTop:'8px'});
                const render=()=>{
                    list.empty();
                    for(const page of pages.filter(p=>normalized(p.name+' '+p.path).includes(normalized(search.value)))) {
                        const proposal=proposals.find(p=>p.path===page.path);
                        const row=list.createEl('button',{text:`${page.name}${proposal?' ✓':''}${page.missing?' (создать страницу)':''}`});
                        row.title=page.path;row.style.textAlign='left';
                        row.onclick=()=>this.select({...page,...proposal,name:page.name,path:page.path});
                    }
                };
                search.oninput=render;render();
                const skip=el.createEl('button',{text:'Оставить без франшизы'});skip.style.marginTop='12px';skip.onclick=()=>this.close();
            }
            select(choice){this.result=choice;this.close();}
            onClose(){this.contentEl.empty();resolve(this.result);}
        }
        new Picker().open();
    });
}

// Строковые сущности: общая нормализация без создания страниц людей/жанров.
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
    // Миграция убирает только wikilink-обертку. Она не меняет написание,
    // не добавляет русскую пару и не подменяет данные источника алиасом.
    const result = [...new Set(source.map(entityName).filter(Boolean))];
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
    for(const key of ENTITY_FIELDS) {
        const block=propertyBlock(yaml,key);
        if(!block)continue;
        const value=ob.parseYaml(block[0])?.[key];
        const result=normalizeEntityField(value,key);
        if(JSON.stringify(value)===JSON.stringify(result))continue;
        const replacement = Array.isArray(result)
            ? `${key}: ${yamlArray(result)}`
            : `${key}: ${JSON.stringify(result)}`;
        yaml=yaml.slice(0,block.index)+replacement+yaml.slice(block.index+block[0].length);
    }
    return parts.prefix+yaml+parts.end+parts.body;
}
function yamlArray(values) {
    return JSON.stringify(values).replace(/[\u007f-\u009f]/g,
        character => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
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

// Полные даты приводятся к ISO без Date.parse и зависимости от часового пояса.
function normalizeRelease(value) {
    if (value instanceof Date) {
        if (!Number.isFinite(value.getTime())) return "";
        value = value.toISOString().slice(0, 10);
    }
    const text = String(value ?? "").trim();
    let year, month, day;
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) [, year, month, day] = match;
    else if ((match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
        [, day, month, year] = match;
    } else if ((match = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/))) {
        day = match[1]; year = match[3];
        month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
            .indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    } else return "";
    year = Number(year); month = Number(month); day = Number(day);
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return "";
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    if (day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function roleFilePath(file) {
    return `${ROOT}/_system/Роли/${file.basename}.роли.md`;
}

function roleValues(value) {
    const source = Array.isArray(value) ? value : [value];
    return [...new Set(source.map(item => String(item ?? "").trim()).filter(Boolean))];
}

function yamlFieldExpression(key) {
    const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Obsidian использует как списки с отступами, так и `Поле:\n- значение`.
    return new RegExp('^(?:'+safe+'|"'+safe+'"|\''+safe+'\'):[^\\r\\n]*(?:\\r?\\n(?:[ \\t]+[^\\r\\n]*|-(?:[ \\t]+[^\\r\\n]*)?|(?=\\r?$)))*', 'm');
}

function setRawYamlField(raw, key, value) {
    const match = raw.match(/^(\ufeff?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    if (!match) return raw;
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    let yaml = match[2];
    const expression = yamlFieldExpression(key);
    const line = `${key}: ${JSON.stringify(value)}`;
    yaml = expression.test(yaml) ? yaml.replace(expression, () => line)
        : yaml.trimEnd() + newline + line;
    return match[1] + yaml + match[3] + raw.slice(match[0].length);
}

function ensureRoleEmbed(raw, rolePath) {
    const withPath = setRawYamlField(raw, "Роли файл", rolePath);
    const match = withPath.match(/^(\ufeff?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/);
    if (!match) return withPath;
    const newline = withPath.includes("\r\n") ? "\r\n" : "\n";
    const oldEntity = /(?:\r?\n)?^[ \t]*<!-- KINO:ENTITY:LINKS:V(?:1|2|3) -->\r?\n```dataviewjs\r?\n[\s\S]*?^```[ \t]*(?:\r?\n|$)/m;
    const oldRoleV1 = /(?:\r?\n)?^[ \t]*<!-- KINO:ROLES:EMBED:V1 -->\r?\n!\[\[[^\]]+\]\][ \t]*(?:\r?\n|$)/m;
    const oldRoleV2 = /(?:\r?\n)?^[ \t]*<!-- KINO:ROLES:EMBED:V2 -->\r?\n<details[^>]*class=["']kino-roles-details["'][^>]*>[\s\S]*?<\/details>[ \t]*(?:\r?\n|$)/m;
    let body = withPath.slice(match[0].length)
        .replace(oldEntity, "").replace(oldRoleV1, "").replace(oldRoleV2, "")
        .replace(/^(?:\r?\n)+/, "");
    const target = rolePath.replace(/\.md$/i, "");
    const embed = [
        "<!-- KINO:ROLES:EMBED:V2 -->",
        '<details class="kino-roles-details">',
        "<summary>🎭 Роли</summary>",
        "",
        `![[${target}]]`,
        "",
        "</details>",
        ""
    ].join(newline);
    return match[0] + embed + newline + body;
}

function ensureRecommendationButton(raw) {
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    const oldButton = /(?:\r?\n)*^[ \t]*<!-- KINO:RECOMMEND:BUTTON:V(?:1|2) -->\r?\n```dataviewjs\r?\n[\s\S]*?^```[ \t]*(?:\r?\n)*/m;
    raw = raw.replace(oldButton, newline);
    const block = [
        "<!-- KINO:RECOMMEND:BUTTON:V2 -->",
        "```dataviewjs",
        'const currentPath = dv.current()?.file?.path || "";',
        'const wrap = dv.container.createDiv({ cls: "kino-recommend-action" });',
        'wrap.style.marginTop = "1em";',
        'wrap.style.marginBottom = "1em";',
        'const btn = wrap.createEl("button", { text: "🔎 Найти похожие" });',
        'btn.style.cursor = "pointer";',
        'btn.style.padding = "6px 12px";',
        'btn.style.fontWeight = "600";',
        'btn.onclick = async () => {',
        '    const original = btn.textContent;',
        '    btn.disabled = true;',
        '    btn.textContent = "⏳ Ищу…";',
        '    try {',
        `        const statePath = ${JSON.stringify(RECOMMEND_STATE)};`,
        `        const pagePath = ${JSON.stringify(RECOMMEND_PAGE)};`,
        '        const payload = JSON.stringify({ reference: currentPath, updatedAt: new Date().toISOString() }, null, 2);',
        '        let stateFile = app.vault.getAbstractFileByPath(statePath);',
        '        if (stateFile) await app.vault.modify(stateFile, payload);',
        '        else {',
        '            const folderPath = "Кино/_system/Прогноз";',
        '            if (!app.vault.getAbstractFileByPath(folderPath)) await app.vault.createFolder(folderPath);',
        '            stateFile = await app.vault.create(statePath, payload);',
        '        }',
        '        const page = app.vault.getAbstractFileByPath(pagePath);',
        '        if (!page) throw new Error("Не найдена Кино/_system/рекомендации.md");',
        '        await app.workspace.getLeaf(false).openFile(page);',
        '    } catch (e) {',
        '        console.error("Кино: рекомендации", e);',
        '        btn.textContent = "⚠ Ошибка";',
        '        btn.title = String(e?.message || e);',
        '        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3500);',
        '        return;',
        '    }',
        '    btn.textContent = original;',
        '    btn.disabled = false;',
        '};',
        "```"
    ].join(newline);
    const roleV2 = /<!-- KINO:ROLES:EMBED:V2 -->\r?\n<details[^>]*class=["']kino-roles-details["'][^>]*>[\s\S]*?<\/details>[ \t]*/m;
    const role = raw.match(roleV2);
    if (role && role.index !== undefined) {
        const at = role.index + role[0].length;
        return raw.slice(0, at).trimEnd() + newline + newline + block + newline + newline + raw.slice(at).replace(/^(?:\r?\n)+/, "");
    }
    const poster = raw.match(/^!\[[^\]]*\]\(https?:\/\/[^\n]+\)\s*$/m);
    if (poster && poster.index !== undefined) {
        return raw.slice(0, poster.index).trimEnd() + newline + newline + block + newline + newline + raw.slice(poster.index);
    }
    return raw.trimEnd() + newline + newline + block + newline;
}

async function writeRoleFile(app, ob, mainFile, movie = {}, kinopoiskId = "", people = {}) {
    const rolePath = roleFilePath(mainFile);
    const mainFm = await frontmatter(app, ob, mainFile);
    const actorNames = roleValues(people.actorNames?.length ? people.actorNames : mainFm.Актеры);
    const actorRoles = roleValues(people.actorRoles?.length ? people.actorRoles : mainFm["Роли актеров"]);
    const directorNames = roleValues(people.directorNames?.length ? people.directorNames
        : (mainFm.Режисер ?? mainFm.Режиссер));
    const genres = roleValues(mainFm.Жанр);
    const imdbId = String(movie?.imdbID || mainFm["imdb Id"] || "").trim();
    const kpId = String(kinopoiskId || mainFm["Кинопоиск ID"] || "").trim();
    const title = String(mainFm.Название || movie?.Title || mainFile.basename).trim();
    const lines = [
        "---",
        `Название: ${JSON.stringify(title)}`,
        `Основная карточка: ${JSON.stringify(mainFile.path)}`,
        `imdb Id: ${JSON.stringify(imdbId)}`,
        `Кинопоиск ID: ${JSON.stringify(kpId)}`,
        `Жанр: ${yamlArray(genres)}`,
        `Режисер: ${yamlArray(directorNames)}`,
        `Актеры: ${yamlArray(actorNames)}`,
        `Роли актеров: ${yamlArray(actorRoles)}`,
        "---",
        ROLE_LINKS_BLOCK,
        ""
    ];
    const content = lines.join("\n");
    await makeFolders(app, rolePath);
    const existing = app.vault.getAbstractFileByPath(rolePath);
    if (existing) await app.vault.modify(existing, content);
    else await app.vault.create(rolePath, content);
    return rolePath;
}
