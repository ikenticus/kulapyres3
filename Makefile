# Makefile for kulapyres3. Do you want to...
#
# Install the python module dependencies::
#
#   make install
#
# Deploy the lamba and crontab::
#
#   make deploy-lambda
#
# Build and push docker container::
#
#   make docker
#
# Deploy the kubernetes pod::
#
#   make deploy-pod
#
# Deploy the kubernetes cronjob::
#
#   make deploy-cronjob
#
# Clean the package of compiled files and deployed archives::
#
#   make clean
#
REPOSITORY := repository
APPNAME := kulapyres3

install:
	pip install -r requirements.txt

deploy-lambda:
	chalice deploy --no-autogen-policy

docker:
	docker build -t ${APPNAME} -f Dockerfile .
	docker tag ${APPNAME} ${REPOSITORY}/${APPNAME}
	docker push ${REPOSITORY}/${APPNAME}

deploy-pod:
	-kubectl delete -f deploy.yaml
	-kubectl create -f deploy.yaml

deploy-cronjob:
	-kubectl create -f cronjob.yaml
	-kubectl replace -f cronjob.yaml

logs:
	kubectl logs --selector=app=kulapyres3 -n tools -f

clean:
	find . -iname *__pycache__* -exec rm \-rf {} \;
	find . -iname *pyc -exec rm {} \;
	rm -rf .chalice/deployment*
