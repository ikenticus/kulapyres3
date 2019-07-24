# Makefile for kulapyres3. Do you want to...
#
# Install the python module dependencies::
#
#   make install
#
# Deploy the lamba and crontab::
#
#   make deploy
#
# Clean the package of compiled files and deployed archives::
#
#   make clean

install:
	pip install -r requirements.txt

deploy:
	chalice deploy --no-autogen-policy

clean:
	find . -iname *__pycache__* -exec rm \-rf {} \;
	find . -iname *pyc -exec rm {} \;
	rm -rf .chalice/deployment*
