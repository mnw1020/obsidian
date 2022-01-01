[http://kubuntu.ru/node/11199](http://kubuntu.ru/node/11199)

[http://habrahabr.ru/sandbox/37839/](http://habrahabr.ru/sandbox/37839/)

1). Включаем драйвер жесткого диска: В BIOS переключаем режим загрузочного диска в AHCI. Загружаемся в Windows, включаем драйвер с помощью фикса от MS, либо вручную правим реестр. Без этого при загрузке Windows из VirtualBox получим BSOD с ошибкой "STOP 0X0000007B INACCESSABLE_BOOT_DEVICE".

2). Установить VirtualBox c сайта.

3). Для того, чтобы работать с виртуальными машинами без root привилегий, добавим пользователя в группы disk и vboxusers: sudo adduser $(whoami) disk sudo adduser $(whoami) vboxusers

4). Создаем загрузчик для Windows: Так как Windows уже установлена и загружает ее линуксовый grub, проще всего создать виртуальный диск iso с существующим grub и загружать с него. Для этого установим пакет xorriso: sudo apt-get install xorriso Создаем директории либо вручную, либо mkdir -p ~/.iso/boot/grub

## В этой директории (~/.iso/boot/grub) создаем файл grub.cfg со следующим содержимым:

## insmod part_msdos set default=0 set timeout=0 menuentry 'Windows 7 (loader) (on /dev/sda3)' --class windows --class os $menuentry_id_option 'osprober-chain-0804FE8104FE70D4' { insmod part_msdos insmod ntfs set root='hd0,msdos3' if [ x$feature_platform_search_hint = xy ]; then search --no-floppy --fs-uuid --set=root --hint-bios=hd0,msdos3 --hint-efi=hd0,msdos3 --hint-baremetal=ahci0,msdos3 0804FE8104FE70D4 else search --no-floppy --fs-uuid --set=root 0804FE8104FE70D4 fi chainloader +1 }

Раздел "menuentry Windows" копируем из /boot/grub/grub.cfg

Создаем grub.iso: grub-mkrescue --output=/home/$USER/.iso/grub.iso /home/$USER/.iso/

5). Создаем vmdk с системным диском C:\ Windows7 ~$ VBoxManage internalcommands createrawvmdk -filename /home/$USER/.VirtualBox/VM/Windows7.vmdk -rawdisk /dev/sda -partitions 3 -relative Здесь "Windows7.vmdk" - название образа, который разместим в папке ~/.VirtualBox/VM/, ранее созданную. А "-partitions 3" - раздел с виндой, который в моем случае размещен на /dev/sda3.

Создаем vmdk с диском D:\ Programs. ~$ VBoxManage internalcommands createrawvmdk -filename /home/$USER/.VirtualBox/VM/Programs.vmdk -rawdisk /dev/sdb -partitions 1 -relative Здесь "-partitions 1" раздел на /dev/sdb1, который я отвел для виндовых программ и игр. Он находится на втором физическом диске, поэтому и нужен второй vmdk-образ.

Если используется несколько виндовых разделов на одном физическом диске, то достаточно создать один vmdk. К примеру: ~$ VBoxManage internalcommands createrawvmdk -filename /home/$USER/.VirtualBox/VM/Windows7.vmdk -rawdisk /dev/sda -partitions 3,4 -relative Здесь "-partitions 3,4" - это /dev/sda3 и /dev/sda4

Virtual box загрузка через USB

Создание VMDK файла.1) Узнаем имя устройства usb user@vboxhost:~$ mount /dev/sda1 on / type ext4 (rw,errors=remount-ro) proc on /proc type proc (rw,noexec,nosuid,nodev) sysfs on /sys type sysfs (rw,noexec,nosuid,nodev) none on /sys/fs/fuse/connections type fusectl (rw) none on /sys/kernel/debug type debugfs (rw) none on /sys/kernel/security type securityfs (rw) udev on /dev type devtmpfs (rw,mode=0755) devpts on /dev/pts type devpts (rw,noexec,nosuid,gid=5,mode=0620) tmpfs on /run type tmpfs (rw,noexec,nosuid,size=10%,mode=0755) none on /run/lock type tmpfs (rw,noexec,nosuid,nodev,size=5242880) none on /run/shm type tmpfs (rw,nosuid,nodev) /dev/sda3 on /home type ext4 (rw) gvfs-fuse-daemon on /home/user/.gvfs type fuse.gvfs-fuse-daemon (rw,nosuid,nodev,user=alexander) /dev/sdc1 on /media/2def28aa-42e6-4494-9c3a-c765940a9bad type ext4 (rw,nosuid,nodev,uhelper=udisks)В моём случае это будет/dev/sdc1 on /media/2def28aa-42e6-4494-9c3a-c765940a9bad type ext4 (rw,nosuid,nodev,uhelper=udisks)Значит моему USB устройству соответствует файл /dev/sdcНе знаю на сколько это может быть опасно работать со смонтированным устройством, но я нахожу целесообразным всё же размонтировать диск перед работой.sudo umount /dev/sdc1Теперь можно собственно создать .vmdk файл выполнив следующую команду:sudo vboxmanage internalcommands createrawvmdk -filename ~/usb.vmdk -rawdisk /dev/sdc2) Определим права файла:user@vboxhost:~$ sudo chown user:user -v usb.vmdk user@vboxhost:~$ sudo chmod 0644 -v usb.vmdk