# kulapyres3
KuLaPyReS3: Kubernetes/Lambda Python Redshift to S3


## Abstract
Python application that will read SQL queries from S3, apply them to AWS Redshift, then write the resulting CSV output back to S3. Additional python functions may be performed on the CSV data and saved as an sufficed `.Function.csv` in the same directory.


## Configuration
Initially you will want to configure the following files:
* Update the bucket names in `chalicelib/settings.json` and `s3queries.sh` to correspond to the S3 bucket in to your organization.
* The database credentials are stored on S3, therefore, update the `queries/database.json` and copy it to your bucket:
```
aws s3 cp queries/database.json s3://bucket/redshift/queries/database.json
```
* For Lambda, ensure that the `.chalice/config.json` matches your needs before deploying with Makefile below.
* For Kubernetes, to avoid having to put AWS credentials, make sure to create and attach a policy that has the proper access to Redshift:
```
    ROLENAME=$( aws iam list-instance-profiles | grep RoleName\":.*eksctl-* | cut -d\" -f4 )
    aws iam attach-role-policy --role-name ${ROLENAME} --policy-arn arn:aws:iam::AWS_ID:policy/kulapyres3-policy`
```
and that your EKS has access to Redshift in order to query.


## Makefile
The Makefile should have all the necessary commands to deploy to either Lambda or Kubernetes.
* For Lambda simply run `make deploy-lambda` after you have made the Configuration changes above.
* For Kubernetes, modify the `__main__` in the `pod.py` according to whether you want an API deployment or a cronjob and run `make docker` to build and push your container once you have updated the repository in the `Makefile`
  * Modify `deploy.yaml` and run `make deploy-pod` for Flask API pod
  * Modify `cronjob.yaml` accordingly and run `make deploy-cronjob` for scheduled python executions


## Nomenclature
* The queries are stored on `s3://bucket/redshift/queries/` in subdirectories.
* The following prefices are utilized to control output destination:
  * `Total.` means that the SQL does not account for `CURRENT_DATE` and is queried across all data. The CSV output for `redshift/queries/subdir/Total.Query.sql` will be stored in `redshift/subdir/Total.Query.csv`.
  * `Graph.` and `Table.` will be queried according to `CURRENT_DATE` and arbitrarily denotes whether the data will be used to generate a Graph or a Table. The CSV output for `redshift/queries/subdir/Graph.Query.sql` will be stored in `redshift/subdir/yyyy/mm/dd/Graph.Query.csv`.
* Suffices can also be used to modify the CSV and store it as a separate CSV. For instance, `redshift/queries/subdir/Total.Query.Pivot.sql` will create both an original `redshift/subdir/Total.Query.csv` as well as `redshift/subdir/Total.QueryPivot.csv`. Add additional suffix functions as needed.
* SQL column headers follow the convention that everything to the right of underscores will be omitted. Therefore, a column header that reads `%change_count` should be displayed as `%Change` while a column header that read `_rate` should not be displayed at all.
* For queries involving handles, like the Instagram example, create a stand-in `handle/` subdirectory along with a corresponding `Total.Handles.sql` that resides in the same subdirectory. The application will loop through all the handle ids and replacing the `HANDLE_ID` within the `handle/*.sql` queries. All queries pertaining to each handle should reside in the `handle/` subdirectory as well.


## Reports
Included is a `sample.html` using the `kulapyres3` all-in-one reporting CSS/JS logic along with a `sample.png` screenshot of the actual report generated with SQL/CSV files produced by this architecture.


## Updates
Currently, this application supports:
* AWS Lambda via chalice
* Kubernetes (tested on EKS)

Aside from any functional changes that you may want to make to the application to handle additional prefices or suffices, once deployed, users should be able to obtain more data simply by adding additional SQL files that will generate additional CSV files automatically during each schedule execution.
