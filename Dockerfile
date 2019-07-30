FROM python:3

ADD pod.py /
ADD pod.txt /
COPY chalicelib ./chalicelib

RUN pip install -r pod.txt

CMD [ "python", "./pod.py" ]
