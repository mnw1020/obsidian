[http://wiki.cyanogenmod.org/w/Doc:_adb_intro#Secure_USB_debugging](http://wiki.cyanogenmod.org/w/Doc:_adb_intro#Secure_USB_debugging)

**[http://linux-notes.org/ustanovka-android-tools-adb-fastboot-qtadb-na-debian-ubuntu-linux-mint/](http://linux-notes.org/ustanovka-android-tools-adb-fastboot-qtadb-na-debian-ubuntu-linux-mint/)**

**sudo apt-get install android-tools-adb android-tools-fastboot**

Подключение Android в Linux

http://ubuntulinux.ru/config/kak-podklyuchit-telefon-s-android-k-ubuntu-kak-mtp-ustrojstvo/

Итак, чтобы можно было использовать в Ubuntu телефон с Android в качестве MTP-устройства, нужно установить пакеты mtpfs -- для того, чтобы можно было использовать телефон, как обычный примонтированный диск. mtp-tools также окажется полезным.

sudo apt-get install mtpfs mtp-tools Далее вводим команду mtp-detect для выяснения подробностей о телефоне, что мы подключили:

$ mtp-detect libmtp version: 1.1.3 Listing raw device(s) Device 0 (VID=04e8 and PID=685c) is a Samsung Galaxy Nexus/Galaxy S i9000/i9250, Android 4.0 updates. Found 1 device(s): Samsung: Galaxy Nexus/Galaxy S i9000/i9250, Android 4.0 updates (04e8:685c) @ bus 1, dev 4 Attempting to connect device(s) LIBMTP PANIC: Unable to find interface & endpoints of device Unable to open raw device 0 OK. Здесь для нас важны 2 числа: VID и PID. Это vendor id и product id -- идентификатор производителя и идентификатор продукта (модели устройства).

Теперь нам нужно отредактировать конфигурационный файл:

sudo gedit /etc/udev/rules.d/51-android.rules Тут то нам и пригодятся VID и PID! Пишем в файле:

SUBSYSTEM"usb", ATTR{idVendor}"04e8", ATTR{idProduct}=="685c", MODE="0666"

Не забыть заменить 04e8 и 685c на нужные VID и PID -- соответственно!

Чтобы правило из конфигурационного файла вступило в силу -- перезапускаем udev:

sudo service udev restart Создаём папку, в которую будет монтироваться (подключаться Android). Например так:

sudo mkdir /media/Android sudo chmod a+rwx /media/Android Теперь добавим себя в группу тех, кто может подключать устройства:

sudo adduser $USER fuse На всякий случай проверим, можно ли пользователям вообще подключать подобные устройства:

sudo gedit /etc/fuse.conf Строчка "#user_allow_other" должна быть раскоментирована (без решётки спереди), то есть "user_allow_other".

После перезагрузки можно будет подключать устройство с помощью довольно длинной команды. Однако, для удобства создадим свои команды, делающие то же самое:

echo "alias android-on=\"mtpfs -o allow_other /media/Android\"" >> ~/.bashrc echo "alias android-off=\"fusermount -u /media/Android\"" >> ~/.bashrc source ~/.bashrc После перезагрузки можно будет выполнить команду "android-on", чтобы подключить телефон. И команду "android-off", чтобы отключить.