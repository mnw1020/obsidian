Устанавливаем пакеты:
```bash
# apt-get install gcc kernel-package libncurses5-dev dpkg-dev libgtk2.0-dev libglib2.0-dev libglade2-dev libqt4-dev

```

Где:

-   gcc - Компилятор
-   dpkg-dev - позволяет создать debian-пакет с ядром
-   kernel-package - позволяет создать debian-пакет с ядром одной командой "make-kpkg kernel_image" из корня дерева исходного кода ядра.
-   libncurses5-dev - для использования menuconfig
-   libgtk2.0-dev libglib2.0-dev libglade2-dev - для использования gconfig
-   libqt4-dev - для использования xconfig

Узнаем версию установленнового ядра:
```bash
$ uname -r
```
Скачиваем ядро [ftp://kernel.org/pub/linux/kernel/](ftp://kernel.org/pub/linux/kernel/) или через wget
```bash
$ wget https://www.kernel.org/pub/linux/kernel/v3.x/linux-3.19.3.tar.xz
```
Распаковываем в /usr/src
```bash
$ cd /usr/src

# tar xf ~/linux-3.19.3.tar.xz
```
В каталоге /usr/src должна быть символьная ссылка "linux", указывающая на текущую версию ядра.
```bash
# ln -s /usr/src/linux-3.19.3 /usr/src/linux

# cd /usr/src/linux
```
Создаем конфиг. Копируем конфиг с текущего загруженого ядра:
```bash
# cp /boot/config-`uname -r` .config
```
Запускаем "make oldconfig" - отвечаем на новые вопросы, старые значения будут сохранены.

Оппции конфигуратора:

-   **config** - традиционный способ конфигурирования. Программа выводит параметры конфигурации по одному, предлагая вам установить для каждого из них свое значение. Не рекоммендуется для неопытных пользователей.
-   **oldconfig** - файл конфигурации создаётся автоматически, основываясь на текущей конфигурации ядра. Рекомендуется для начинающих.
-   **defconfig** - файл конфигурации создаётся автоматически, основываясь на значениях по-умолчанию.
-   **menuconfig** - псевдографический интерфейс ручной конфигурации, не требует последовательного ввода значений параметров. Рекомендуется для использования в терминале.
-   **xconfig** - графический (X) интерфейс ручной конфигурации, не требует последовательного ввода значений параметров.
-   **gconfig** - графический (GTK+) интерфейс ручной конфигурации, не требует последовательного ввода значений параметров. Рекомендуется для использования в среде GNOME.
-   **localmodconfig** - файл конфигурации, создающийся автоматически, в который включается только то, что нужно данному конкретному устройству. При вызове данной команды большая часть ядра будет замодулирована
-   **localyesconfig** - файл конфигурации, похожий на предыдущий, но здесь большая часть будет включена непосредственно в ядро. Идеальный вариант для начинающих.

...Собираем:
```bash
$ make -j 3
```
Где,

-   j 3 - Количество потоков (количество ядер +1)

... _или_ Собираем в deb-пакеты:
```bash
$ make -j 5 KDEB_PKGVERSION=1.ribalinux deb-pkg
```
Если собирали вручную, вручную же и устанавливаем:

модули в /lib/modules:
```bash
# make modules_install
```
заголовки:
```bash
# make headers_install
```
затем устанавливаем ядро автоматически:
```bash
# make install
```
или руками:
```bash
# cp arch/x86/boot/bzImage /boot/vmlinuz-3.19.3

# cp System.map /boot/System.map-3.19.3

# cp .config /boot/config-3.19.3
```

создаем INIT RAM FS (INIT RAM DISK) или initramfs (initrd)

# update-initramfs -c -k 3.19.3

Создаем ссылки в /boot

```bash
# ln -s /boot/config-3.19.3 /boot/config

# ln -s /boot/System.map-3.19.3 /boot/System.map

# ln -s /boot/vmlinuz-3.19.3 /boot/vmlinuz

# ln -s /boot/initrd /boot/initrd
```

затем обновляем загрузчик:

```py
# update-grub
```

Если собирали в deb-пакеты, просто устанавливаем их:

```py
# dpkg -i ../linux*.deb

# reboot
```

---

Патчи

[grsecurity.net](http://grsecurity.net) - патч безопасности

[pf.natalenko.name](http://pf.natalenko.name) - патч для нетбуков (увеличение производительностти)

Накладываются следующим образом:

Распаковка:

```bash
xz -d -c %filename%
```

Сначала проверяем совместимость:

```bash
# patch -p --dry-run < %filename%
```

И установка:

```bash
# patch -p1 < %filename%
```

Если нужно, отмена установки:

```bash
# patch -R -p1 < %filename%
```

Затем компилируем, etc.

---

---

Скрипт обновления ядра

```
# расскоментировать, если пакетов нет
#apt-get install kernel-package libncurses5-dev fakeroot wget bzip2echo Installing $1cd /usr/srcwget -c [kernel.org/pub/linux/kernel/v2.6/linux-](http://kernel.org/pub/linux/kernel/v2.6/linux-)$1.tar.bz2tar xjf linux-$1.tar.bz2rm linuxln -s linux-$1 linuxcd /usr/src/linuxcp /boot/config-`uname -r` ./.config
# make menuconfig
# раскомментировать если понадобилось поменять конфигурацию make-kpkg cleanfakeroot make-kpkg --initrd kernel_image kernel_headersdpkg -i linux*.debrm -f *.debНа автомате, этот скрипт обновляет у меня ядро еще с 2.6.27, запускаю так./kernel.sh 2.6.32.7
```