FROM eclipse-mosquitto
COPY ./config/mosquitto.conf ./etc/mosquitto/mosquitto.conf
COPY ./config/passw .
RUN mosquitto_passwd -U passw && mv passw  /etc/mosquitto

ENTRYPOINT ["/usr/sbin/mosquitto", "-c", "/etc/mosquitto/mosquitto.conf"]