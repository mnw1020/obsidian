Сначала разберемся с жабой:

1). Определить разрядность системы

file /sbin/init

2). Убедитесь, что в вашей системе установлена Java.

java -version

3). Полностью удалите OpenJDK/JRE

sudo apt-get purge openjdk-*

4). скачайте java JDK

http://www.oracle.com/technetwork/java/javase/downloads/index.html

5). Скопируйте бинарные файлы Oracle Java в папку /usr/local/java

sudo cp -r /home/user/Downloads/jdk-7u51-linux-i586.tar.gz /usr/local/java/

6). Распакуйте архив

sudo tar xvzf /usr/local/java/jdk-7u51-linux-i586.tar.gz

7). Отредактируйте системный файл /etc/profile и добавьте следующие системные переменные.

sudo gedit /etc/profile

Напечатайте/скопируйте/вставьте:

JAVA_HOME=/usr/local/java/jdk1.8.0_31PATH=$PATH:$HOME/bin:$JAVA_HOME/binJRE_HOME=/usr/local/java/jre1.8.0_31PATH=$PATH:$HOME/bin:$JRE_HOME/binexport JAVA_HOMEexport JRE_HOMEexport PATH

8). Укажите системе место расположения обновленной версии Oracle Java JRE/JDK (система переключится на использование новой версии Oracle Java). Напечатайте:

sudo update-alternatives --install "/usr/bin/java" "java" usr/local/java/jdk1.7.0_51/bin/java " 1

Эта команда уведомляет систему, что Oracle Java JRE доступна для использования. Напечатайте:

sudo update-alternatives --install "/usr/bin/javac" "javac" "/usr/local/java/jdk1.7.0_51/bin/javac" 1

Эта команда уведомляет систему, что Oracle Java JDK доступна для использования. Напечатайте:

sudo update-alternatives --install "/usr/bin/javaws" "javaws" "/usr/local/java/jdk1.7.0_51/bin/javaws" 1

Эта команда уведомляет систему, что Web Start Oracle Java доступна для использования.

9). Укажите системе, что обновленная версия Oracle Java JDK/JRE будет версией Java по умолчанию. Напечатайте:

sudo update-alternatives --set java /usr/local/java/jdk1.7.0_51/bin/java

Эта команда установит среду исполнения Java. Напечатайте:

sudo update-alternatives --set javac /usr/local/java/jdk1.7.0_51/bin/javac

Эта команда установит компилятор Javac. Напечатайте:

sudo update-alternatives --set javaws /usr/local/java/jdk1.7.0_51/bin/javaws

Эта команда установит Java Web start.

10). Проверка установки

java -version

javac -version

11) Установка плагина Firefox

sudo ln -s /usr/local/java/jdk1.7.0_51/jre/lib/i386/libnpjp2.so /home/user/.mozilla/plugins/

- -----

Теперь флеш:

http://rtfm.co.ua/debian-ustanovka-flash-dlya-firefoxchromium/