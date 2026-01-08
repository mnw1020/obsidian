[http://avreg.net/howto_x-org-server.html](http://avreg.net/howto_x-org-server.html)_

_Установка X:_

```
# aptitude install x-window-system_ или # aptitude install xserver-xorg
```
Проверяем:

```
# aptitude show xorg
```
Смотрим тип видеоадаптера и используемый им драйвер.

```
$ lspci -ks `lspci|grep VGA|awk '{print $1}'`
01:00.0 VGA compatible controller: nVidia Corporation G84 [GeForce 8600 GTS] (rev a1)
        Subsystem: LeadTek Research Inc. Device 2a86
        Kernel driver in use: nvidia

```

Если строки "Kernel driver in use: ХХХХХ" нет или ХХХХХ в ней - "vesa" или "fbdev" - почти наверняка графический сервер X использует универсальные очень медленные драйвера не задействующие аппаратные возможности видеокарты по ускорению видеовывода и первым делом нужно установить и задействовать "родной" драйвер.

Драйвера для видеоадаптеров поставляемые вместе с сервером X:

-   cписок установленных: `$ aptitude search '~ixserver-xorg-video-'`
-   cписок НЕ установленных:
 ```
$ aptitude search '!~ixserver-xorg-video-
Установка дров nvidia
# aptitude install nvidia-kernel-dkms
Если не загружается модуль nvidia, загружаем заголовок ядра и пересобираем дрова:
# aptitude install linux-headers-`-uname -r`
# dpkg-reconfigure nvidia-kernel-dkms
Запускаем X-сервер: Генерируем xorg.conf:
# nvidia-xconfig# startx
```