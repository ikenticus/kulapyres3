#!/bin/bash
#
# Tool to upload/download queries from S3
#

bucket=bucket-name
prefix=s3://${bucket}/redshift/

upload() {
    for q in $(find queries -iname '*.sql'); do
        aws s3 cp $q ${prefix}$q
    done
}

download() {
    for q in $(aws s3 ls ${prefix}queries/ --recursive | egrep "\.sql$" | awk '{ print $NF }'); do
        destfile=${q#redshift/}
        destdir=${destfile%/*}
        [ ! -d $destdir ] && mkdir -p $destdir
        aws s3 cp ${prefix}$destfile $destfile
    done
}

###  MAIN  ###
case $1 in
    dn) download ;;
    up) upload ;;
    *) echo "Usage: ${0##*/} [up/dn]"
esac
