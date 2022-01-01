**Создать файл -**

touch %file%

**Сделать файл исполняемым**

-  chmod +x %file%

**Смена владельца**

sudo chown user:user -v usb.vmdk

**права доступа**

sudo chmod 777 -v usb.vmdk

**Добавление пути в переменную PATH**

set PATH $PATH /home/user/bin

echo $PATH

**Запуск скрипта**

- sh %file% или .\ %file% или python %file или perl %file%

**Поместить файл в автозагрузку**

- update-rc.d %file% defaults 95

Для удаления - update-rc.d %file% remove

**Сокращения коммандной строки**

- alias %name%="%command%"

**Смена MAC адреса**

ifconfig eth0 down //Завершить соединение

ifconfig eth0 hw ether 00:00:00:00:00:00

ifconfig eth0 up //Запустить соединение

ifconfig //Проверить настройки

**Права root**

в консоли необходимо набрать:

sudo passwd или sudo su и получить терминал рута. илиь sudo -i и стать суперюзером без su.

**Alias terminala**

`редактируются в файле ~/.bash_aliasesнапримерalias man='man -L ru'alias install='sudo apt-get install -y'применить настройки:source ~/.bash_aliases**Вывод терминала**`

редактируем файл ~/.bashrc

nano ~/.bashrcтуда дописываем строку

export PS1="\[\e[00;33m\][\[\e[0m\]\[\e[00;36m\]\w\[\e[0m\]\[\e[00;33m\]]\[\e[0m\]\[\e[00;31m\]>>\[\e[0m\]"

саму строку можно сгенерировать на http://bashrcgenerator.com/