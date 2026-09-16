/* QuickAdd: Кино - Обновить имена */
// Сценарий запускается вручную. В обычное добавление фильма интернет-запросы
// для имен не добавляются: найденные пары сохраняются в одном JSON-кэше.
const CACHE_PATH = "Кино/_system/kino-person-alias-cache.json";
const STATIC_ALIASES = {"Актеры":{"angelabassett":"Angela Bassett (Анджела Бассетт)","анджелабассетт":"Angela Bassett (Анджела Бассетт)","chrisferrarini":"Chris Ferrarini (Крис Феррарини)","крисферрарини":"Chris Ferrarini (Крис Феррарини)","erniesloman":"Ernie Sloman (Эрни Сломан)","эрнисломан":"Ernie Sloman (Эрни Сломан)","caryymizobe":"Cary Y. Mizobe (Кэри И. Мидзобэ)","кэриимидзобэ":"Cary Y. Mizobe (Кэри И. Мидзобэ)","mitchyapko":"Mitch Yapko (Митч Япко)","митчяпко":"Mitch Yapko (Митч Япко)","victorjaco":"Victor Jaco (Виктор Александр Яко)","викторалександряко":"Victor Jaco (Виктор Александр Яко)","aamirkhan":"Aamir Khan (Аамир Кхан)","аамиркхан":"Aamir Khan (Аамир Кхан)","aaronpoole":"Aaron Poole (Аарон Пул)","ааронпул":"Aaron Poole (Аарон Пул)","adriangrenier":"Adrian Grenier (Эдриан Гренье)","эдриангренье":"Adrian Grenier (Эдриан Гренье)","alainchabat":"Alain Chabat (Ален Шаба)","аленшаба":"Alain Chabat (Ален Шаба)","alaindelon":"Alain Delon (Ален Делон)","аленделон":"Alain Delon (Ален Делон)","alekseydemidov":"Aleksey Demidov (Алексей Демидов)","алексеидемидов":"Aleksey Demidov (Алексей Демидов)","allegraedwards":"Allegra Edwards (Аллегра Эдвардс)","аллеграэдвардс":"Allegra Edwards (Аллегра Эдвардс)","alyssadiaz":"Alyssa Diaz (Алисса Диас)","алиссадиас":"Alyssa Diaz (Алисса Диас)","andreariseborough":"Andrea Riseborough (Андреа Райзборо)","андреараизборо":"Andrea Riseborough (Андреа Райзборо)","andrewlincoln":"Andrew Lincoln (Эндрю Линкольн)","эндрюлинкольн":"Andrew Lincoln (Эндрю Линкольн)","andrewscott":"Andrew Scott (Эндрю Скотт)","эндрюскотт":"Andrew Scott (Эндрю Скотт)","andreyskorokhod":"Andrey Skorokhod (Андрей Скороход)","андреискороход":"Andrey Skorokhod (Андрей Скороход)","andyallo":"Andy Allo (Энди Алло)","эндиалло":"Andy Allo (Энди Алло)","andylau":"Andy Lau (Энди Лау)","эндилау":"Andy Lau (Энди Лау)","anjanavasan":"Anjana Vasan (Анджана Васан)","анджанавасан":"Anjana Vasan (Анджана Васан)","annehathaway":"Anne Hathaway (Энн Хэтэуэй)","эннхэтэуэи":"Anne Hathaway (Энн Хэтэуэй)","anushkasharma":"Anushka Sharma (Анушка Шарма)","анушкашарма":"Anushka Sharma (Анушка Шарма)","arminmuellerstahl":"Armin Mueller-Stahl (Армин Мюллер-Шталь)","арминмюллершталь":"Armin Mueller-Stahl (Армин Мюллер-Шталь)","arnoldschwarzenegger":"Arnold Schwarzenegger (Арнольд Шварценеггер)","арнольдшварценеггер":"Arnold Schwarzenegger (Арнольд Шварценеггер)","austinabrams":"Austin Abrams (Остин Абрамс)","остинабрамс":"Austin Abrams (Остин Абрамс)","baedoona":"Bae Doona (Пэ Ду-на)","пэдуна":"Bae Doona (Пэ Ду-на)","бэдуна":"Bae Doona (Пэ Ду-на)","barrypepper":"Barry Pepper (Барри Пеппер)","баррипеппер":"Barry Pepper (Барри Пеппер)","benoitmagimel":"Benoît Magimel (Бенуа Мажимель)","бенуамажимель":"Benoît Magimel (Бенуа Мажимель)","billskarsgard":"Bill Skarsgård (Билл Скарсгард)","биллскарсгард":"Bill Skarsgård (Билл Скарсгард)","billyconnolly":"Billy Connolly (Билли Коннолли)","билликоннолли":"Billy Connolly (Билли Коннолли)","blakelively":"Blake Lively (Блейк Лайвли)","блеиклаивли":"Blake Lively (Блейк Лайвли)","bobgunton":"Bob Gunton (Боб Гантон)","бобгантон":"Bob Gunton (Боб Гантон)","bokeemwoodbine":"Bokeem Woodbine (Боким Вудбайн)","бокимвудбаин":"Bokeem Woodbine (Боким Вудбайн)","bradpitt":"Brad Pitt (Брэд Питт)","брэдпитт":"Brad Pitt (Брэд Питт)","брэдпит":"Brad Pitt (Брэд Питт)","bradleycooper":"Bradley Cooper (Брэдли Купер)","брэдликупер":"Bradley Cooper (Брэдли Купер)","brinnakelly":"Brinna Kelly (Бринна Келли)","бриннакелли":"Brinna Kelly (Бринна Келли)","bryancranston":"Bryan Cranston (Брайан Крэнстон)","браианкрэнстон":"Bryan Cranston (Брайан Крэнстон)","camilamendes":"Camila Mendes (Камила Мендес)","камиламендес":"Camila Mendes (Камила Мендес)","carlosmanuelvesga":"Carlos-Manuel Vesga (Карлос-Мануэль Весга)","карлосмануэльвесга":"Carlos-Manuel Vesga (Карлос-Мануэль Весга)","cateblanchett":"Cate Blanchett (Кейт Бланшетт)","кеитбланшетт":"Cate Blanchett (Кейт Бланшетт)","charliebarnett":"Charlie Barnett (Чарли Барнетт)","чарлибарнетт":"Charlie Barnett (Чарли Барнетт)","charlotteritchie":"Charlotte Ritchie (Шарлотта Ритчи)","шарлоттаритчи":"Charlotte Ritchie (Шарлотта Ритчи)","christianbale":"Christian Bale (Кристиан Бэйл)","кристианбэил":"Christian Bale (Кристиан Бэйл)","christophwaltz":"Christoph Waltz (Кристоф Вальц)","кристофвальц":"Christoph Waltz (Кристоф Вальц)","ciaranhinds":"Ciarán Hinds (Киран Хайндс)","киранхаиндс":"Ciarán Hinds (Киран Хайндс)","cliffcurtis":"Cliff Curtis (Клифф Кёртис)","клиффкертис":"Cliff Curtis (Клифф Кёртис)","cliffordbanagale":"Clifford Bañagale (Клиффорд Баньягале)","клиффордбаньягале":"Clifford Bañagale (Клиффорд Баньягале)","clinteastwood":"Clint Eastwood (Клинт Иствуд)","клинтиствуд":"Clint Eastwood (Клинт Иствуд)","colehauser":"Cole Hauser (Коул Хаузер)","коулхаузер":"Cole Hauser (Коул Хаузер)","colinfarrell":"Colin Farrell (Колин Фаррелл)","колинфаррелл":"Colin Farrell (Колин Фаррелл)","common":"Common (Коммон)","коммон":"Common (Коммон)","craigbierko":"Craig Bierko (Крэйг Бирко)","крэигбирко":"Craig Bierko (Крэйг Бирко)","cristinmilioti":"Cristin Milioti (Кристин Милиоти)","кристинмилиоти":"Cristin Milioti (Кристин Милиоти)","dafnekeen":"Dafne Keen (Дафни Кин)","дафникин":"Dafne Keen (Дафни Кин)","dakotafanning":"Dakota Fanning (Дакота Фаннинг)","дакотафаннинг":"Dakota Fanning (Дакота Фаннинг)","damsonidris":"Damson Idris (Дэмсон Идрис)","дэмсонидрис":"Damson Idris (Дэмсон Идрис)","danaigurira":"Danai Gurira (Данай Гурира)","данаигурира":"Danai Gurira (Данай Гурира)","davefranco":"Dave Franco (Дэйв Франко)","дэивфранко":"Dave Franco (Дэйв Франко)","demimoore":"Demi Moore (Деми Мур)","демимур":"Demi Moore (Деми Мур)","dennisquaid":"Dennis Quaid (Деннис Куэйд)","деннискуэид":"Dennis Quaid (Деннис Куэйд)","denzelwashington":"Denzel Washington (Дензел Вашингтон)","дензелвашингтон":"Denzel Washington (Дензел Вашингтон)","dolphlundgren":"Dolph Lundgren (Дольф Лундгрен)","дольфлундгрен":"Dolph Lundgren (Дольф Лундгрен)","donnieyen":"Donnie Yen (Донни Йен)","доннииен":"Donnie Yen (Донни Йен)","dougrayscott":"Dougray Scott (Дугрей Скотт)","дугреискотт":"Dougray Scott (Дугрей Скотт)","eddieredmayne":"Eddie Redmayne (Эдди Редмэйн)","эддиредмэин":"Eddie Redmayne (Эдди Редмэйн)","eizagonzalez":"Eiza González (Эйса Гонсалес)","эисагонсалес":"Eiza González (Эйса Гонсалес)","eleanormatsuura":"Eleanor Matsuura (Элинор Мацуура)","элинормацуура":"Eleanor Matsuura (Элинор Мацуура)","elliotpage":"Elliot Page (Эллиот Пейдж)","эллиотпеидж":"Elliot Page (Эллиот Пейдж)","erickeenleyside":"Eric Keenleyside (Эрик Кинсайд)","эриккинсаид":"Eric Keenleyside (Эрик Кинсайд)","ethanhawke":"Ethan Hawke (Итан Хоук)","итанхоук":"Ethan Hawke (Итан Хоук)","evgeniytsyganov":"Evgeniy Tsyganov (Евгений Цыганов)","евгениицыганов":"Evgeniy Tsyganov (Евгений Цыганов)","florencepugh":"Florence Pugh (Флоренс Пью)","флоренспью":"Florence Pugh (Флоренс Пью)","frankdillane":"Frank Dillane (Фрэнк Диллэйн)","фрэнкдиллэин":"Frank Dillane (Фрэнк Диллэйн)","gabrielleone":"Gabriel Leone (Габриэл Леоне)","габриэллеоне":"Gabriel Leone (Габриэл Леоне)","garyoldman":"Gary Oldman (Гэри Олдман)","гэриолдман":"Gary Oldman (Гэри Олдман)","гариолдман":"Gary Oldman (Гэри Олдман)","genarowlands":"Gena Rowlands (Джина Роулендс)","джинароулендс":"Gena Rowlands (Джина Роулендс)","georgeclooney":"George Clooney (Джордж Клуни)","джорджклуни":"George Clooney (Джордж Клуни)","geraintwyndavies":"Geraint Wyn Davies (Джерент Уин Дэйвис)","джерентуиндэивис":"Geraint Wyn Davies (Джерент Уин Дэйвис)","gerardbutler":"Gerard Butler (Джерард Батлер)","джерардбатлер":"Gerard Butler (Джерард Батлер)","ginoanthonypesi":"Gino Anthony Pesi (Джино Энтони Пези)","джиноэнтонипези":"Gino Anthony Pesi (Джино Энтони Пези)","gretalee":"Greta Lee (Грета Ли)","гретали":"Greta Lee (Грета Ли)","gretchenmol":"Gretchen Mol (Гретхен Мол)","гретхенмол":"Gretchen Mol (Гретхен Мол)","gustafhammarsten":"Gustaf Hammarsten (Густаф Хаммарстен)","густафхаммарстен":"Gustaf Hammarsten (Густаф Хаммарстен)","gwynethpaltrow":"Gwyneth Paltrow (Гвинет Пэлтроу)","гвинетпэлтроу":"Gwyneth Paltrow (Гвинет Пэлтроу)","halleberry":"Halle Berry (Холли Берри)","холлиберри":"Halle Berry (Холли Берри)","harrisonford":"Harrison Ford (Харрисон Форд)","харрисонфорд":"Harrison Ford (Харрисон Форд)","heweiyu":"Hewei Yu (Юй Хэвэй)","юихэвэи":"Hewei Yu (Юй Хэвэй)","ianhart":"Ian Hart (Иэн Харт)","иэнхарт":"Ian Hart (Иэн Харт)","idriselba":"Idris Elba (Идрис Эльба)","идрисэльба":"Idris Elba (Идрис Эльба)","ikouwais":"Iko Uwais (Ико Ювайс)","икоюваис":"Iko Uwais (Ико Ювайс)","jksimmons":"J.K. Simmons (Дж.К. Симмонс)","джксиммонс":"J.K. Simmons (Дж.К. Симмонс)","jacindabarrett":"Jacinda Barrett (Джасинда Барретт)","джасиндабарретт":"Jacinda Barrett (Джасинда Барретт)","jackalcott":"Jack Alcott (Джек Элкотт)","джекэлкотт":"Jack Alcott (Джек Элкотт)","jamesgarner":"James Garner (Джеймс Гарнер)","джеимсгарнер":"James Garner (Джеймс Гарнер)","jamesmarsden":"James Marsden (Джеймс Марсден)","джеимсмарсден":"James Marsden (Джеймс Марсден)","jamesortiz":"James Ortiz (Джеймс Ортис)","джеимсортис":"James Ortiz (Джеймс Ортис)","jamieclayton":"Jamie Clayton (Джейми Клейтон)","джеимиклеитон":"Jamie Clayton (Джейми Клейтон)","jaredpadalecki":"Jared Padalecki (Джаред Падалеки)","джаредпадалеки":"Jared Padalecki (Джаред Падалеки)","jasonstuart":"Jason Stuart (Джейсон Стюарт)","джеисонстюарт":"Jason Stuart (Джейсон Стюарт)","javierbardem":"Javier Bardem (Хавьер Бардем)","хавьербардем":"Javier Bardem (Хавьер Бардем)","jazsinclair":"Jaz Sinclair (Джаз Синклер)","джазсинклер":"Jaz Sinclair (Джаз Синклер)","jeffreydeanmorgan":"Jeffrey Dean Morgan (Джеффри Дин Морган)","джеффридинморган":"Jeffrey Dean Morgan (Джеффри Дин Морган)","jennifergarner":"Jennifer Garner (Дженнифер Гарнер)","дженнифергарнер":"Jennifer Garner (Дженнифер Гарнер)","jensenackles":"Jensen Ackles (Дженсен Эклз)","дженсенэклз":"Jensen Ackles (Дженсен Эклз)","jesseeisenberg":"Jesse Eisenberg (Джесси Айзенберг)","джессиаизенберг":"Jesse Eisenberg (Джесси Айзенберг)","jimbeaver":"Jim Beaver (Джим Бивер)","джимбивер":"Jim Beaver (Джим Бивер)","jimcarrey":"Jim Carrey (Джим Керри)","джимкерри":"Jim Carrey (Джим Керри)","jinseonkyu":"Jin Seon-kyu (Чин Сон-гю)","чинсонгю":"Jin Seon-kyu (Чин Сон-гю)","jingwu":"Jing Wu (У Цзин)","уцзин":"Jing Wu (У Цзин)","johncena":"John Cena (Джон Сина)","джонсина":"John Cena (Джон Сина)","johnkrasinski":"John Krasinski (Джон Красински)","джонкрасински":"John Krasinski (Джон Красински)","johnmalkovich":"John Malkovich (Джон Малкович)","джонмалкович":"John Malkovich (Джон Малкович)","johnnyflynn":"Johnny Flynn (Джонни Флинн)","джоннифлинн":"Johnny Flynn (Джонни Флинн)","joshlucas":"Josh Lucas (Джош Лукас)","джошлукас":"Josh Lucas (Джош Лукас)","jovanadepo":"Jovan Adepo (Джован Адепо)","джованадепо":"Jovan Adepo (Джован Адепо)","judelaw":"Jude Law (Джуд Лоу)","джудлоу":"Jude Law (Джуд Лоу)","julialouisdreyfus":"Julia Louis-Dreyfus (Джулия Луис-Дрейфус)","джулиялуисдреифус":"Julia Louis-Dreyfus (Джулия Луис-Дрейфус)","juliaroberts":"Julia Roberts (Джулия Робертс)","джулияробертс":"Julia Roberts (Джулия Робертс)","justintheroux":"Justin Theroux (Джастин Теру)","джастинтеру":"Justin Theroux (Джастин Теру)","karolinawydra":"Karolina Wydra (Каролина Выдра)","каролинавыдра":"Karolina Wydra (Каролина Выдра)","karolineeichhorn":"Karoline Eichhorn (Каролине Айххорн)","каролинеаиххорн":"Karoline Eichhorn (Каролине Айххорн)","kayascodelario":"Kaya Scodelario (Кая Скоделарио)","каяскоделарио":"Kaya Scodelario (Кая Скоделарио)","kenwatanabe":"Ken Watanabe (Кэн Ватанабэ)","кэнватанабэ":"Ken Watanabe (Кэн Ватанабэ)","kentoyamazaki":"Kento Yamazaki (Кэнто Ямазаки)","кэнтоямазаки":"Kento Yamazaki (Кэнто Ямазаки)","kellyreilly":"Kelly Reilly (Келли Райлли)","келлираилли":"Kelly Reilly (Келли Райлли)","kimbyeongcheol":"Kim Byeong-cheol (Ким Бён-чхоль)","кимбенчхоль":"Kim Byeong-cheol (Ким Бён-чхоль)","kimdickens":"Kim Dickens (Ким Диккенс)","кимдиккенс":"Kim Dickens (Ким Диккенс)","kimhyejun":"Kim Hye-jun (Ким Хе-джун)","кимхеджун":"Kim Hye-jun (Ким Хе-джун)","kimtaeri":"Kim Tae-ri (Ким Тхэ-ри)","кимтхэри":"Kim Tae-ri (Ким Тхэ-ри)","kitconnor":"Kit Connor (Кит Коннор)","китконнор":"Kit Connor (Кит Коннор)","kitharington":"Kit Harington (Кит Харингтон)","китхарингтон":"Kit Harington (Кит Харингтон)","kurtrussell":"Kurt Russell (Курт Рассел)","куртрассел":"Kurt Russell (Курт Рассел)","lashanalynch":"Lashana Lynch (Лашана Линч)","лашаналинч":"Lashana Lynch (Лашана Линч)","laurencohan":"Lauren Cohan (Лорен Коэн)","лоренкоэн":"Lauren Cohan (Лорен Коэн)","laurencefishburne":"Laurence Fishburne (Лоренс Фишбёрн)","лоренсфишберн":"Laurence Fishburne (Лоренс Фишбёрн)","leejaewook":"Lee Jae-wook (Ли Джэ-ук)","лиджэук":"Lee Jae-wook (Ли Джэ-ук)","leejunho":"Lee Jun-ho (Ли Джун-хо)","лиджунхо":"Lee Jun-ho (Ли Джун-хо)","lenaheadey":"Lena Headey (Лена Хиди)","ленахиди":"Lena Headey (Лена Хиди)","lesliebibb":"Leslie Bibb (Лесли Бибб)","леслибибб":"Leslie Bibb (Лесли Бибб)","lesliemann":"Leslie Mann (Лесли Манн)","леслиманн":"Leslie Mann (Лесли Манн)","liamcunningham":"Liam Cunningham (Лиам Каннингэм)","лиамканнингэм":"Liam Cunningham (Лиам Каннингэм)","liamhemsworth":"Liam Hemsworth (Лиам Хемсворт)","лиамхемсворт":"Liam Hemsworth (Лиам Хемсворт)","lindacardellini":"Linda Cardellini (Линда Карделлини)","линдакарделлини":"Linda Cardellini (Линда Карделлини)","lisavicari":"Lisa Vicari (Лиза Викари)","лизавикари":"Lisa Vicari (Лиза Викари)","lizzebroadway":"Lizze Broadway (Лиззи Бродвей)","лиззибродвеи":"Lizze Broadway (Лиззи Бродвей)","louishofmann":"Louis Hofmann (Луис Хофманн)","луисхофманн":"Louis Hofmann (Луис Хофманн)","luyizhang":"Luyi Zhang (Чжан Луйи)","чжанлуии":"Luyi Zhang (Чжан Луйи)","leadrucker":"Léa Drucker (Леа Дрюкер)","леадрюкер":"Léa Drucker (Леа Дрюкер)","maddiephillips":"Maddie Phillips (Мэдди Филлипс)","мэддифиллипс":"Maddie Phillips (Мэдди Филлипс)","madhavan":"Madhavan (Мадхаван)","мадхаван":"Madhavan (Мадхаван)","mahershalaali":"Mahershala Ali (Махершала Али)","махершалаали":"Mahershala Ali (Махершала Али)","mahinanapoleon":"Mahina Napoleon (Махина Наполеон)","махинанаполеон":"Mahina Napoleon (Махина Наполеон)","malikzidi":"Malik Zidi (Малик Зиди)","маликзиди":"Malik Zidi (Малик Зиди)","mantatng":"Man-Tat Ng (Нг Мань-Тат)","нгманьтат":"Man-Tat Ng (Нг Мань-Тат)","margaretqualley":"Margaret Qualley (Маргарет Куэлли)","маргареткуэлли":"Margaret Qualley (Маргарет Куэлли)","marielaforet":"Marie Laforêt (Мари Лафоре)","марилафоре":"Marie Laforêt (Мари Лафоре)","markruffalo":"Mark Ruffalo (Марк Руффало)","маркруффало":"Mark Ruffalo (Марк Руффало)","markwahlberg":"Mark Wahlberg (Марк Уолберг)","маркуолберг":"Mark Wahlberg (Марк Уолберг)","mathieuamalric":"Mathieu Amalric (Матьё Амальрик)","матьеамальрик":"Mathieu Amalric (Матьё Амальрик)","mattdamon":"Matt Damon (Мэтт Дэймон)","мэттдэимон":"Matt Damon (Мэтт Дэймон)","mattmella":"Matt Mella (Мэтт Мелла)","мэттмелла":"Matt Mella (Мэтт Мелла)","matthewbroderick":"Matthew Broderick (Мэттью Бродерик)","мэттьюбродерик":"Matthew Broderick (Мэттью Бродерик)","mauriceronet":"Maurice Ronet (Морис Роне)","морисроне":"Maurice Ronet (Морис Роне)","mauriciohenao":"Mauricio Hénao (Маурисио Энао)","маурисиоэнао":"Mauricio Hénao (Маурисио Энао)","mayahawke":"Maya Hawke (Майя Хоук)","маияхоук":"Maya Hawke (Майя Хоук)","melgibson":"Mel Gibson (Мэл Гибсон)","мэлгибсон":"Mel Gibson (Мэл Гибсон)","melissamcbride":"Melissa McBride (Мелисса Макбрайд)","мелиссамакбраид":"Melissa McBride (Мелисса Макбрайд)","merylstreep":"Meryl Streep (Мэрил Стрип)","мэрилстрип":"Meryl Streep (Мэрил Стрип)","michaelchall":"Michael C. Hall (Майкл Си Холл)","маиклсихолл":"Michael C. Hall (Майкл Си Холл)","michaelcera":"Michael Cera (Майкл Сера)","маиклсера":"Michael Cera (Майкл Сера)","michaelironside":"Michael Ironside (Майкл Айронсайд)","маиклаиронсаид":"Michael Ironside (Майкл Айронсайд)","michelledockery":"Michelle Dockery (Мишель Докери)","мишельдокери":"Michelle Dockery (Мишель Докери)","michellemonaghan":"Michelle Monaghan (Мишель Монахэн)","мишельмонахэн":"Michelle Monaghan (Мишель Монахэн)","michielhuisman":"Michiel Huisman (Михил Хёйсман)","михилхеисман":"Michiel Huisman (Михил Хёйсман)","mikhailevlanov":"Mikhail Evlanov (Михаил Евланов)","михаилевланов":"Mikhail Evlanov (Михаил Евланов)","milakunis":"Mila Kunis (Мила Кунис)","милакунис":"Mila Kunis (Мила Кунис)","monasingh":"Mona Singh (Мона Сингх)","монасингх":"Mona Singh (Мона Сингх)","morenabaccarin":"Morena Baccarin (Морена Баккарин)","моренабаккарин":"Morena Baccarin (Морена Баккарин)","morganfreeman":"Morgan Freeman (Морган Фриман)","морганфриман":"Morgan Freeman (Морган Фриман)","melanielaurent":"Mélanie Laurent (Мелани Лоран)","меланилоран":"Mélanie Laurent (Мелани Лоран)","natalieportman":"Natalie Portman (Натали Портман)","наталипортман":"Natalie Portman (Натали Портман)","natashalyonne":"Natasha Lyonne (Наташа Лионн)","наташалионн":"Natasha Lyonne (Наташа Лионн)","nathanfillion":"Nathan Fillion (Нэйтан Филлион)","нэитанфиллион":"Nathan Fillion (Нэйтан Филлион)","nicolascage":"Nicolas Cage (Николас Кейдж)","николаскеидж":"Nicolas Cage (Николас Кейдж)","nijiromurakami":"Nijirô Murakami (Нидзиро Мураками)","нидзиромураками":"Nijirô Murakami (Нидзиро Мураками)","normanreedus":"Norman Reedus (Норман Ридус)","норманридус":"Norman Reedus (Норман Ридус)","olegvasilkov":"Oleg Vasilkov (Олег Васильков)","олегвасильков":"Oleg Vasilkov (Олег Васильков)","owenwilson":"Owen Wilson (Оуэн Уилсон)","оуэнуилсон":"Owen Wilson (Оуэн Уилсон)","paapaessiedu":"Paapa Essiedu (Паапа Эссьеду)","паапаэссьеду":"Paapa Essiedu (Паапа Эссьеду)","parksodam":"Park So-dam (Пак Со-дам)","паксодам":"Park So-dam (Пак Со-дам)","pelageyanevzorova":"Pelageya Nevzorova (Пелагея Невзорова)","пелагеяневзорова":"Pelageya Nevzorova (Пелагея Невзорова)","pennbadgley":"Penn Badgley (Пенн Бэджли)","пеннбэджли":"Penn Badgley (Пенн Бэджли)","philipkeung":"Philip Keung (Филип Кёнг)","филипкенг":"Philip Keung (Филип Кёнг)","pollyannamcintosh":"Pollyanna McIntosh (Поллианна Макинтош)","поллианнамакинтош":"Pollyanna McIntosh (Поллианна Макинтош)","priyankachoprajonas":"Priyanka Chopra Jonas (Приянка Чопра Джонас)","приянкачопраджонас":"Priyanka Chopra Jonas (Приянка Чопра Джонас)","rachelmcadams":"Rachel McAdams (Рэйчел Макадамс)","рэичелмакадамс":"Rachel McAdams (Рэйчел Макадамс)","rheaseehorn":"Rhea Seehorn (Рея Сихорн)","реясихорн":"Rhea Seehorn (Рея Сихорн)","richardtjones":"Richard T. Jones (Ричард Т. Джонс)","ричардтджонс":"Richard T. Jones (Ричард Т. Джонс)","robbieamell":"Robbie Amell (Робби Амелл)","роббиамелл":"Robbie Amell (Робби Амелл)","robindunne":"Robin Dunne (Робин Данн)","робинданн":"Robin Dunne (Робин Данн)","rogerdalefloyd":"Roger Dale Floyd (Роджер Дейл Флойд)","роджердеилфлоид":"Roger Dale Floyd (Роджер Дейл Флойд)","romainlevi":"Romain Levi (Ромен Леви)","роменлеви":"Romain Levi (Ромен Леви)","romangriffindavis":"Roman Griffin Davis (Роман Гриффин Дэвис)","романгриффиндэвис":"Roman Griffin Davis (Роман Гриффин Дэвис)","ruthwilson":"Ruth Wilson (Рут Уилсон)","рутуилсон":"Ruth Wilson (Рут Уилсон)","ryangosling":"Ryan Gosling (Райан Гослинг)","раиангослинг":"Ryan Gosling (Райан Гослинг)","sachabaroncohen":"Sacha Baron Cohen (Саша Барон Коэн)","сашабаронкоэн":"Sacha Baron Cohen (Саша Барон Коэн)","samworthington":"Sam Worthington (Сэм Уортингтон)","сэмуортингтон":"Sam Worthington (Сэм Уортингтон)","sandrabullock":"Sandra Bullock (Сандра Буллок)","сандрабуллок":"Sandra Bullock (Сандра Буллок)","sandrahuller":"Sandra Hüller (Сандра Хюллер)","сандрахюллер":"Sandra Hüller (Сандра Хюллер)","sanjaydutt":"Sanjay Dutt (Санджай Датт)","санджаидатт":"Sanjay Dutt (Санджай Датт)","scottglenn":"Scott Glenn (Скотт Гленн)","скоттгленн":"Scott Glenn (Скотт Гленн)","sebastianstan":"Sebastian Stan (Себастиан Стэн)","себастианстэн":"Sebastian Stan (Себастиан Стэн)","seoinguk":"Seo In-guk (Со Ин-гук)","соингук":"Seo In-guk (Со Ин-гук)","sharonstone":"Sharon Stone (Шэрон Стоун)","шэронстоун":"Sharon Stone (Шэрон Стоун)","sigourneyweaver":"Sigourney Weaver (Сигурни Уивер)","сигурниуивер":"Sigourney Weaver (Сигурни Уивер)","songjoongki":"Song Joong-ki (Сон Джун-ги)","сонджунги":"Song Joong-ki (Сон Джун-ги)","sophiadimartino":"Sophia Di Martino (София Ди Мартино)","софиядимартино":"Sophia Di Martino (София Ди Мартино)","steveaustin":"Steve Austin (Стив Остин)","стивостин":"Steve Austin (Стив Остин)","taotsuchiya":"Tao Tsuchiya (Тао Цутия)","таоцутия":"Tao Tsuchiya (Тао Цутия)","taylourpaige":"Taylour Paige (Тейлор Пейдж)","теилорпеидж":"Taylour Paige (Тейлор Пейдж)","timrobbins":"Tim Robbins (Тим Роббинс)","тимроббинс":"Tim Robbins (Тим Роббинс)","tinadesai":"Tina Desai (Тина Десай)","тинадесаи":"Tina Desai (Тина Десай)","tomcruise":"Tom Cruise (Том Круз)","томкруз":"Tom Cruise (Том Круз)","tomhiddleston":"Tom Hiddleston (Том Хиддлстон)","томхиддлстон":"Tom Hiddleston (Том Хиддлстон)","tophergrace":"Topher Grace (Тофер Грейс)","тофергреис":"Topher Grace (Тофер Грейс)","umathurman":"Uma Thurman (Ума Турман)","уматурман":"Uma Thurman (Ума Турман)","valeriyafedorovich":"Valeriya Fedorovich (Валерия Федорович)","валерияфедорович":"Valeriya Fedorovich (Валерия Федорович)","victoriapedretti":"Victoria Pedretti (Виктория Педретти)","викторияпедретти":"Victoria Pedretti (Виктория Педретти)","viggomortensen":"Viggo Mortensen (Вигго Мортенсен)","виггомортенсен":"Viggo Mortensen (Вигго Мортенсен)","williamshatner":"William Shatner (Уильям Шэтнер)","уильямшэтнер":"William Shatner (Уильям Шэтнер)","woodyharrelson":"Woody Harrelson (Вуди Харрельсон)","вудихаррельсон":"Woody Harrelson (Вуди Харрельсон)","yanmanzizhu":"Yanmanzi Zhu (Чжу Яньманьцзы)","чжуяньманьцзы":"Yanmanzi Zhu (Чжу Яньманьцзы)","yahyaabdulmateenii":"Yahya Abdul-Mateen II (Яхья Абдул-Матин II)","яхьяабдулматинii":"Yahya Abdul-Mateen II (Яхья Абдул-Матин II)","yisha":"Yi Sha (И Ша)","иша":"Yi Sha (И Ша)","yongjianlin":"Yongjian Lin (Линь Юнцзянь)","линьюнцзянь":"Yongjian Lin (Линь Юнцзянь)","yuliyaperesild":"Yuliya Peresild (Юлия Пересильд)","юлияпересильд":"Yuliya Peresild (Юлия Пересильд)","zhannaepple":"Zhanna Epple (Жанна Эппле)","жаннаэппле":"Zhanna Epple (Жанна Эппле)","zhiwang":"Zhi Wang (Ван Чжи)","ванчжи":"Zhi Wang (Ван Чжи)","zoesaldana":"Zoe Saldaña (Зои Салдана)","зоисалдана":"Zoe Saldaña (Зои Салдана)"},"Режисер":{"brettscottermilio":"Brett Scott Ermilio (Бретт Скотт Эрмилио)","бреттскоттэрмилио":"Brett Scott Ermilio (Бретт Скотт Эрмилио)","alexandreaja":"Alexandre Aja (Александр Ажа)","александража":"Alexandre Aja (Александр Ажа)","amanchang":"Aman Chang (Аман Чан)","аманчан":"Aman Chang (Аман Чан)","чанминь":"Aman Chang (Аман Чан)","anthonyminghella":"Anthony Minghella (Энтони Мингелла)","энтонимингелла":"Anthony Minghella (Энтони Мингелла)","antoinefuqua":"Antoine Fuqua (Антуан Фукуа)","антуанфукуа":"Antoine Fuqua (Антуан Фукуа)","benstiller":"Ben Stiller (Бен Стиллер)","бенстиллер":"Ben Stiller (Бен Стиллер)","bobgale":"Bob Gale (Боб Гейл)","бобгеил":"Bob Gale (Боб Гейл)","christophermiller":"Christopher Miller (Кристофер Миллер)","кристофермиллер":"Christopher Miller (Кристофер Миллер)","clinteastwood":"Clint Eastwood (Клинт Иствуд)","клинтиствуд":"Clint Eastwood (Клинт Иствуд)","coraliefargeat":"Coralie Fargeat (Корали Фаржа)","коралифаржа":"Coralie Fargeat (Корали Фаржа)","dchamilton":"D.C. Hamilton (Д. С. Хэмилтон)","дсхэмилтон":"D.C. Hamilton (Д. С. Хэмилтон)","davidfrankel":"David Frankel (Дэвид Фрэнкел)","дэвидфрэнкел":"David Frankel (Дэвид Фрэнкел)","edwardzwick":"Edward Zwick (Эдвард Цвик)","эдвардцвик":"Edward Zwick (Эдвард Цвик)","frankdarabont":"Frank Darabont (Фрэнк Дарабонт)","фрэнкдарабонт":"Frank Darabont (Фрэнк Дарабонт)","frantgwo":"Frant Gwo (Го Фань)","гофань":"Frant Gwo (Го Фань)","garyross":"Gary Ross (Гэри Росс)","гэриросс":"Gary Ross (Гэри Росс)","guyritchie":"Guy Ritchie (Гай Ричи)","гаиричи":"Guy Ritchie (Гай Ричи)","ilyanaishuller":"Ilya Naishuller (Илья Найшуллер)","ильянаишуллер":"Ilya Naishuller (Илья Найшуллер)","jakeschreier":"Jake Schreier (Джейк Шрейер)","джеикшреиер":"Jake Schreier (Джейк Шрейер)","jamescameron":"James Cameron (Джеймс Кэмерон)","джеимскэмерон":"James Cameron (Джеймс Кэмерон)","jasoncabell":"Jason Cabell (Джейсон Кабелл)","джеисонкабелл":"Jason Cabell (Джейсон Кабелл)","jasonkwan":"Jason Kwan (Джейсон Кван)","джеисонкван":"Jason Kwan (Джейсон Кван)","jasonreitman":"Jason Reitman (Джейсон Райтман)","джеисонраитман":"Jason Reitman (Джейсон Райтман)","jenniferkaytinrobinson":"Jennifer Kaytin Robinson (Дженнифер Кейтин Робинсон)","дженниферкеитинробинсон":"Jennifer Kaytin Robinson (Дженнифер Кейтин Робинсон)","jessevjohnson":"Jesse V. Johnson (Джесси Джонсон)","джессиджонсон":"Jesse V. Johnson (Джесси Джонсон)","jingwong":"Jing Wong (Вонг Цзин)","вонгцзин":"Jing Wong (Вонг Цзин)","вонгджин":"Jing Wong (Вонг Цзин)","jonmchu":"Jon M. Chu (Джон М. Чу)","джонмчу":"Jon M. Chu (Джон М. Чу)","josefrusnak":"Josef Rusnak (Йозеф Руснак)","иозефруснак":"Josef Rusnak (Йозеф Руснак)","josephkosinski":"Joseph Kosinski (Джозеф Косински)","джозефкосински":"Joseph Kosinski (Джозеф Косински)","julianfarino":"Julian Farino (Джулиан Фарино)","джулианфарино":"Julian Farino (Джулиан Фарино)","larrycharles":"Larry Charles (Ларри Чарльз)","ларричарльз":"Larry Charles (Ларри Чарльз)","leetolandkrieger":"Lee Toland Krieger (Ли Толанд Кригер)","литоландкригер":"Lee Toland Krieger (Ли Толанд Кригер)","lenwiseman":"Len Wiseman (Лен Уайзман)","ленуаизман":"Len Wiseman (Лен Уайзман)","lilianacavani":"Liliana Cavani (Лилиана Кавани)","лилианакавани":"Liliana Cavani (Лилиана Кавани)","louisleterrier":"Louis Leterrier (Луи Летерье)","луилетерье":"Louis Leterrier (Луи Летерье)","markneveldine":"Mark Neveldine (Марк Невелдайн)","маркневелдаин":"Mark Neveldine (Марк Невелдайн)","maryharron":"Mary Harron (Мэри Хэррон)","мэрихэррон":"Mary Harron (Мэри Хэррон)","melgibson":"Mel Gibson (Мэл Гибсон)","мэлгибсон":"Mel Gibson (Мэл Гибсон)","morganjfreeman":"Morgan J. Freeman (Морган Дж. Фриман)","морганджфриман":"Morgan J. Freeman (Морган Дж. Фриман)","nickcassavetes":"Nick Cassavetes (Ник Кассаветис)","никкассаветис":"Nick Cassavetes (Ник Кассаветис)","paulverhoeven":"Paul Verhoeven (Пол Верховен)","полверховен":"Paul Verhoeven (Пол Верховен)","peterberg":"Peter Berg (Питер Берг)","питерберг":"Peter Berg (Питер Берг)","peterfarrelly":"Peter Farrelly (Питер Фаррелли)","питерфаррелли":"Peter Farrelly (Питер Фаррелли)","phillord":"Phil Lord (Фил Лорд)","филлорд":"Phil Lord (Фил Лорд)","quentindupieux":"Quentin Dupieux (Квентин Дюпье)","квентиндюпье":"Quentin Dupieux (Квентин Дюпье)","rajkumarhirani":"Rajkumar Hirani (Раджкумар Хирани)","раджкумархирани":"Rajkumar Hirani (Раджкумар Хирани)","reneclement":"René Clément (Рене Клеман)","ренеклеман":"René Clément (Рене Клеман)","ricromanwaugh":"Ric Roman Waugh (Рик Роман Во)","рикроманво":"Ric Roman Waugh (Рик Роман Во)","rogerspottiswoode":"Roger Spottiswoode (Роджер Споттисвуд)","роджерспоттисвуд":"Roger Spottiswoode (Роджер Споттисвуд)","rubenfleischer":"Ruben Fleischer (Рубен Фляйшер)","рубенфляишер":"Ruben Fleischer (Рубен Фляйшер)","sergeymokritskiy":"Sergey Mokritskiy (Сергей Мокрицкий)","сергеимокрицкии":"Sergey Mokritskiy (Сергей Мокрицкий)","simoncellanjones":"Simon Cellan Jones (Саймон Селлан Джонс)","саимонселланджонс":"Simon Cellan Jones (Саймон Селлан Джонс)","stevensoderbergh":"Steven Soderbergh (Стивен Содерберг)","стивенсодерберг":"Steven Soderbergh (Стивен Содерберг)","sungheejo":"Sung-hee Jo (Чо Сон-хи)","чосонхи":"Sung-hee Jo (Чо Сон-хи)"}};
const PERSON_FIELDS = ["Актеры", "Режисер"];
const BATCH_SIZE = 60;
const CACHE_DAYS = 30;
const REQUEST_PAUSE = 1200;
const IMDB_MATCH_VERSION = 1;
const requestCooldown = new Map();
let updateRunning = false;

module.exports = async function updateKinoPersons(params) {
    const { app, obsidian: ob } = params;
    if (updateRunning) return;
    updateRunning = true;
    const notice = new ob.Notice("Кино: обновляю имена…", 0);
    try {
        const cache = await loadCache(app);
        let aliases = mergeAliases(cache);
        const records = [];
        const unknown = new Map();

        for (const file of app.vault.getMarkdownFiles()) {
            if (!isCardPath(file.path)) continue;
            const raw = await app.vault.read(file);
            if (!isMediaRaw(file.path, raw, ob)) continue;
            const parts = yamlParts(raw);
            if (!parts) continue;
            const record = {
                file,
                raw,
                imdbId: readScalar(parts.yaml, "imdb Id", ob),
                people: { Актеры: [], Режисер: [] }
            };
            for (const field of PERSON_FIELDS) {
                const block = propertyBlock(parts.yaml, field);
                if (!block) continue;
                let value;
                try { value = ob.parseYaml(block[0])?.[field]; } catch (_) { continue; }
                for (const item of asArray(value)) {
                    const text = entityName(item);
                    if (!text || text === "N/A") continue;
                    record.people[field].push(text);
                    if (personDisplay(field, text, aliases) !== text) continue;
                    const key = personKey(text);
                    if (!key) continue;
                    if (!unknown.has(key)) unknown.set(key, { key, text, fields: new Set() });
                    unknown.get(key).fields.add(field);
                }
            }
            records.push(record);
        }

        const candidates = [...unknown.values()].filter(entry =>
            [...entry.fields].some(field => !recentlyChecked(cache, field, entry.key))
        );
        const newPairs = new Set();

        for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
            const batch = candidates.slice(offset, offset + BATCH_SIZE);
            const result = await wikidataBatch(ob, batch);
            if (result?.ok) {
                const checkedAt = Date.now();
                for (const entry of batch) {
                    const hit = result.hits.get(entry.key);
                    for (const field of entry.fields) {
                        cache.Проверено[field][entry.key] = checkedAt;
                        if (!hit) continue;
                        if (addAlias(cache, field, entry.text, hit.display)) {
                            newPairs.add(field + ":" + entry.key);
                        }
                    }
                }
                aliases = mergeAliases(cache);
                await saveCache(app, cache);
            }
            notice.setMessage?.(`Кино: проверено имен ${Math.min(offset + batch.length, candidates.length)} из ${candidates.length}…`);
            await pause(0);
        }

        // Wikidata не содержит часть малоизвестных людей или не хранит русскую
        // подпись. Для таких карточек используем точный IMDb ID фильма: один
        // запрос получает титровый список фильма, после чего имена сопоставляются
        // только с людьми из этого же списка и только при достаточном сходстве.
        const imdbTargets = new Map();
        for (const record of records) {
            if (!/^tt\d+$/.test(record.imdbId || "")) continue;
            const hasUnknown = PERSON_FIELDS.some(field =>
                (record.people[field] || []).some(text => personDisplay(field, text, aliases) === text)
            );
            if (!hasUnknown || recentlyCheckedImdb(cache, record.imdbId)) continue;
            if (!imdbTargets.has(record.imdbId)) imdbTargets.set(record.imdbId, []);
            imdbTargets.get(record.imdbId).push(record);
        }

        const imdbEntries = [...imdbTargets.entries()];
        for (let index = 0; index < imdbEntries.length; index++) {
            const [imdbId, titleRecords] = imdbEntries[index];
            const result = await imdbCredits(ob, imdbId);
            if (result?.ok) {
                cache.ПровереноIMDb[imdbId] = { at: Date.now(), version: IMDB_MATCH_VERSION };
                for (const record of titleRecords) {
                    for (const field of PERSON_FIELDS) {
                        const values = record.people[field] || [];
                        for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
                            const source = values[valueIndex];
                            if (!/[А-Яа-яЁё]/.test(source)) continue;
                            if (personDisplay(field, source, aliases) !== source) continue;
                            const hit = matchImdbCredit(source, result.credits, field, valueIndex);
                            if (!hit) continue;
                            const display = `${hit.name} (${source})`;
                            if (addAlias(cache, field, source, display)) {
                                newPairs.add(field + ":" + personKey(source));
                            }
                        }
                    }
                }
                aliases = mergeAliases(cache);
                await saveCache(app, cache);
            }
            notice.setMessage?.(`Кино: проверены IMDb-кредиты ${Math.min(index + 1, imdbEntries.length)} из ${imdbEntries.length}…`);
            await pause(0);
        }

        let updated = 0;
        for (const record of records) {
            const after = normalizeRaw(record.raw, ob, aliases);
            if (after === record.raw) continue;
            let applied = false;
            await app.vault.process(record.file, current => {
                if (current !== record.raw) return current;
                applied = true;
                return after;
            });
            if (applied) updated++;
        }
        await saveCache(app, cache);

        notice.hide?.();
        new ob.Notice(
            `Готово: карточек ${records.length}, обновлено ${updated}, новых соответствий ${newPairs.size}.`,
            10000
        );
    } catch (_) {
        // Сценарий не показывает пользователю сетевые и отдельные проблемные имена.
        // Локальные соответствия уже применяются до сетевого поиска, а кэш сохраняется
        // после каждого успешно обработанного пакета.
        notice.hide?.();
    } finally {
        updateRunning = false;
    }
};

function pause(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function emptyCache() {
    return {
        Актеры: {},
        Режисер: {},
        Проверено: { Актеры: {}, Режисер: {} },
        ПровереноIMDb: {}
    };
}

async function loadCache(app) {
    const empty = emptyCache();
    const file = app.vault.getAbstractFileByPath(CACHE_PATH);
    if (!file) return empty;
    try {
        const data = JSON.parse(await app.vault.read(file));
        return {
            Актеры: data?.Актеры && typeof data.Актеры === "object" ? data.Актеры : {},
            Режисер: data?.Режисер && typeof data.Режисер === "object" ? data.Режисер : {},
            Проверено: {
                Актеры: data?.Проверено?.Актеры && typeof data.Проверено.Актеры === "object" ? data.Проверено.Актеры : {},
                Режисер: data?.Проверено?.Режисер && typeof data.Проверено.Режисер === "object" ? data.Проверено.Режисер : {}
            },
            ПровереноIMDb: data?.ПровереноIMDb && typeof data.ПровереноIMDb === "object" ? data.ПровереноIMDb : {}
        };
    } catch (_) { return empty; }
}

async function saveCache(app, data) {
    const folder = CACHE_PATH.split("/").slice(0, -1).join("/");
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    const content = JSON.stringify(data, null, 2) + "\n";
    const file = app.vault.getAbstractFileByPath(CACHE_PATH);
    if (file) await app.vault.modify(file, content);
    else await app.vault.create(CACHE_PATH, content);
}

function mergeAliases(cache) {
    const result = {
        Актеры: { ...(STATIC_ALIASES.Актеры || {}) },
        Режисер: { ...(STATIC_ALIASES.Режисер || {}) }
    };
    for (const field of PERSON_FIELDS) {
        for (const [key, value] of Object.entries(cache[field] || {})) {
            if (!result[field][key]) result[field][key] = value;
        }
    }
    return result;
}

function recentlyChecked(cache, field, key) {
    const stamp = Number(cache.Проверено?.[field]?.[key] || 0);
    return Number.isFinite(stamp) && stamp > Date.now() - CACHE_DAYS * 86400000;
}

function recentlyCheckedImdb(cache, imdbId) {
    const value = cache.ПровереноIMDb?.[imdbId];
    if (!value || typeof value !== "object" || value.version !== IMDB_MATCH_VERSION) return false;
    const stamp = Number(value.at || 0);
    return Number.isFinite(stamp) && stamp > Date.now() - CACHE_DAYS * 86400000;
}

function addAlias(cache, field, source, display) {
    if (!cache[field] || !display) return false;
    let changed = false;
    for (const value of [source, display]) {
        const key = personKey(value);
        if (!key) continue;
        if (!cache[field][key]) {
            cache[field][key] = display;
            changed = true;
        }
    }
    return changed;
}

function personKey(value) {
    let text = String(value ?? "").trim().normalize("NFC");
    text = text.replace(/^\[\[([\s\S]+?)\]\]$/, "$1");
    text = text.replace(/\s*\([^)]*\)\s*$/, "");
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^0-9a-zа-я]/gi, "");
}

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

function personDisplay(field, value, aliases) {
    const text = String(value ?? "").trim().normalize("NFC");
    return aliases[field]?.[personKey(text)] || text;
}

function asArray(value) { return Array.isArray(value) ? value : [value]; }

function isCardPath(path) { return /^Кино\/[^/]+\.md$/.test(path); }

function yamlParts(raw) {
    const match = raw.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
    return match ? { prefix: match[1], yaml: match[2], end: match[3], body: raw.slice(match[0].length) } : null;
}

function propertyBlock(yaml, key) {
    const pattern = new RegExp("^(?:" + key + "|\\\"" + key + "\\\"|'" + key + "'):[^\\r\\n]*(?:\\r?\\n(?![^ \\t\\r\\n#][^\\r\\n]*:)[^\\r\\n]*)*", "m");
    return yaml.match(pattern);
}

function readScalar(yaml, key, ob) {
    const block = propertyBlock(yaml, key);
    if (!block) return "";
    try {
        const value = ob.parseYaml(block[0])?.[key];
        return String(value ?? "").trim();
    } catch (_) { return ""; }
}

function isMediaRaw(path, raw, ob) {
    const parts = yamlParts(raw);
    if (!isCardPath(path) || !parts) return false;
    const block = propertyBlock(parts.yaml, "tags");
    if (!block) return false;
    let tags;
    try { tags = ob.parseYaml(block[0])?.tags; } catch (_) { return false; }
    return asArray(tags).some(value => ["movies", "serial"].includes(String(value).replace(/^#/, "")));
}

function normalizeField(value, field, aliases) {
    if (value == null) return value;
    const values = asArray(value).map(entityName).map(text =>
        field === "Актеры" || field === "Режисер" ? personDisplay(field, text, aliases) : text
    ).filter(Boolean);
    const result = [...new Set(values)];
    return Array.isArray(value) ? result : (result[0] || "");
}

function normalizeRaw(raw, ob, aliases) {
    const parts = yamlParts(raw);
    if (!parts) return raw;
    let yaml = parts.yaml;
    const newline = raw.includes("\r\n") ? "\r\n" : "\n";
    for (const field of PERSON_FIELDS) {
        const block = propertyBlock(yaml, field);
        if (!block) continue;
        let value;
        try { value = ob.parseYaml(block[0])?.[field]; } catch (_) { continue; }
        const result = normalizeField(value, field, aliases);
        if (JSON.stringify(value) === JSON.stringify(result)) continue;
        const replacement = Array.isArray(result)
            ? field + ":" + (result.length ? newline + result.map(x => "  - " + JSON.stringify(x)).join(newline) : " []")
            : field + ": " + JSON.stringify(result);
        yaml = yaml.slice(0, block.index) + replacement + yaml.slice(block.index + block[0].length);
    }
    return parts.prefix + yaml + parts.end + parts.body;
}

async function requestJson(ob, base, params, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const url = new URL(base);
    if (method === "GET") {
        Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    }
    const host = url.host;
    for (let attempt = 0; attempt < 4; attempt++) {
        await pause(Math.max(0, (requestCooldown.get(host) || 0) - Date.now()));
        requestCooldown.set(host, Date.now() + REQUEST_PAUSE);
        let timer;
        try {
            const headers = options.headers || (method === "GET"
                ? { Accept: "application/sparql-results+json", "User-Agent": "ObsidianKinoteka/2.0" }
                : { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "ObsidianKinoteka/2.0" });
            const request = { url: url.href, method, throw: false, headers };
            if (options.body != null) request.body = options.body;
            const response = await Promise.race([
                ob.requestUrl(request),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 30000); })
            ]);
            const status = Number(response?.status || 0);
            if ([429, 500, 502, 503, 504].includes(status)) {
                const retryHeader = Object.entries(response?.headers || {})
                    .find(([key]) => key.toLowerCase() === "retry-after")?.[1];
                const retryNumber = Number(retryHeader);
                const retryDate = retryHeader ? Date.parse(String(retryHeader)) : NaN;
                const pauseMs = Number.isFinite(retryNumber)
                    ? Math.max(2000, retryNumber * 1000)
                    : Number.isFinite(retryDate) ? Math.max(2000, retryDate - Date.now()) : 5000 * (attempt + 1);
                requestCooldown.set(host, Date.now() + Math.min(60000, pauseMs));
                continue;
            }
            if (status < 200 || status >= 300 || !response?.json) return null;
            return response.json;
        } catch (_) {
            requestCooldown.set(host, Date.now() + Math.min(60000, 5000 * (attempt + 1)));
        } finally { clearTimeout(timer); }
    }
    return null;
}

async function imdbCredits(ob, imdbId) {
    const query = `query TitleCredits($id: ID!) {
      title(id: $id) {
        credits(first: 200, filter: { categories: ["director", "actor", "actress", "self"] }) {
          edges {
            node {
              name { nameText { text } }
              category { id text }
            }
          }
        }
      }
    }`;
    const data = await requestJson(ob, "https://api.graphql.imdb.com/", null, {
        method: "POST",
        body: JSON.stringify({ query, variables: { id: imdbId } }),
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Origin: "https://www.imdb.com",
            Referer: "https://www.imdb.com/",
            "User-Agent": "Mozilla/5.0 (ObsidianKinoteka/2.0)"
        }
    });
    if (!data || data.errors || !data.data?.title) return null;
    const credits = [];
    for (const edge of data.data.title.credits?.edges || []) {
        const node = edge?.node;
        const name = String(node?.name?.nameText?.text || "").trim();
        const category = String(node?.category?.id || node?.category?.text || "").toLowerCase();
        if (!name) continue;
        const role = category === "director" || category.includes("director")
            ? "Режисер"
            : ["actor", "actress", "self"].includes(category) || category.includes("actor")
                ? "Актеры" : "";
        if (role) credits.push({ name, role });
    }
    return { ok: true, credits };
}

const CYRILLIC_LATIN = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
};

function romanName(value) {
    let text = String(value ?? "").replace(/\([^)]*\)/g, "").toLocaleLowerCase("ru");
    text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let result = "";
    for (const char of text) result += CYRILLIC_LATIN[char] ?? char;
    return result.replace(/[^a-z0-9]+/g, " ").trim();
}

function nameParts(value) {
    return romanName(value).split(/\s+/).filter(Boolean);
}

function phoneticName(value) {
    let text = romanName(value);
    // Частые расхождения русской транслитерации и написания имени в IMDb:
    // Крис/Chris, Кэри/Cary, Яко/Jaco, Мидзобэ/Mizobe, Виктор/Victor.
    text = text.replace(/tch/g, "k").replace(/ch/g, "k").replace(/dz/g, "z");
    text = text.replace(/ph/g, "f").replace(/kh/g, "h");
    text = text.replace(/j/g, "y").replace(/c/g, "k").replace(/q/g, "k");
    text = text.replace(/w/g, "v");
    text = text.replace(/[aeiouy]+/g, "a").replace(/(.)\1+/g, "$1");
    return text;
}

function phoneticParts(value) {
    return phoneticName(value).split(/\s+/).filter(Boolean);
}

function editDistance(left, right) {
    const a = String(left), b = String(right);
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const saved = row[j];
            row[j] = a[i - 1] === b[j - 1]
                ? diagonal
                : Math.min(row[j] + 1, row[j - 1] + 1, diagonal + 1);
            diagonal = saved;
        }
    }
    return row[b.length];
}

function similarity(left, right) {
    if (!left || !right) return 0;
    if (left === right) return 1;
    return 1 - editDistance(left, right) / Math.max(left.length, right.length);
}

function creditScore(source, candidate, position, sourceIndex) {
    const sourceParts = nameParts(source);
    const candidateParts = nameParts(candidate);
    const sourcePhonetic = phoneticParts(source);
    const candidatePhonetic = phoneticParts(candidate);
    if (!sourceParts.length || !candidateParts.length) return null;
    const surname = Math.max(
        similarity(sourceParts[sourceParts.length - 1], candidateParts[candidateParts.length - 1]),
        similarity(sourcePhonetic[sourcePhonetic.length - 1], candidatePhonetic[candidatePhonetic.length - 1])
    );
    const first = Math.max(
        similarity(sourceParts[0], candidateParts[0]),
        similarity(sourcePhonetic[0], candidatePhonetic[0])
    );
    const full = Math.max(
        similarity(sourceParts.join(""), candidateParts.join("")),
        similarity(sourcePhonetic.join(""), candidatePhonetic.join(""))
    );
    const positionBonus = position === sourceIndex ? 0.04 : 0;
    return { surname, first, full, score: surname * 0.55 + first * 0.25 + full * 0.20 + positionBonus };
}

function matchImdbCredit(source, credits, field, sourceIndex) {
    const candidates = (credits || []).filter(credit => credit.role === field);
    const scored = candidates.map((credit, position) => ({
        credit,
        metrics: creditScore(source, credit.name, position, sourceIndex)
    })).filter(value => value.metrics);
    scored.sort((left, right) => right.metrics.score - left.metrics.score);
    const best = scored[0];
    const second = scored[1];
    if (!best) return null;
    if (best.metrics.surname < 0.60 || best.metrics.first < 0.35 || best.metrics.full < 0.46) return null;
    if (best.metrics.score < 0.63) return null;
    if (second && best.metrics.score - second.metrics.score < 0.08) return null;
    return best.credit;
}

function sparqlLiteral(value, language) {
    const text = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        .replace(/\r/g, "\\r").replace(/\n/g, "\\n");
    return '"' + text + '"@' + language;
}

async function wikidataBatch(ob, batch) {
    const values = [...new Set(batch.map(entry => sparqlLiteral(entry.text, /[А-Яа-яЁё]/.test(entry.text) ? "ru" : "en")))];
    if (!values.length) return { ok: true, hits: new Map() };
    const query = `SELECT DISTINCT ?source ?person ?en ?ru WHERE {
      VALUES ?source { ${values.join(" ")} }
      { ?person rdfs:label ?source } UNION { ?person skos:altLabel ?source }
      ?person wdt:P31/wdt:P279* wd:Q5 .
      OPTIONAL { ?person rdfs:label ?en . FILTER(LANG(?en)="en") }
      OPTIONAL { ?person rdfs:label ?ru . FILTER(LANG(?ru)="ru") }
      FILTER(BOUND(?en) && BOUND(?ru))
    } LIMIT 2000`;
    const data = await requestJson(ob, "https://query.wikidata.org/sparql", { format: "json", query });
    if (!data) return null;
    const grouped = new Map();
    for (const row of data.results?.bindings || []) {
        const source = row.source?.value;
        const person = row.person?.value;
        const english = row.en?.value;
        const russian = row.ru?.value;
        if (!source || !person || !english || !russian) continue;
        if (!grouped.has(source)) grouped.set(source, new Map());
        grouped.get(source).set(person, `${english} (${russian})`);
    }
    const hits = new Map();
    for (const [source, people] of grouped) {
        if (people.size !== 1) continue;
        hits.set(personKey(source), { display: [...people.values()][0] });
    }
    return { ok: true, hits };
}
