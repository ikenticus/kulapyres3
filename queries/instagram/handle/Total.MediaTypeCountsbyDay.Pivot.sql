SELECT DATE_TRUNC('day', created) AS date,
       media_type,
       COUNT(*) AS posts
  FROM instagram.media
 WHERE owner_id = 'HANDLE_ID'
   AND parent_id = 'None'
 GROUP BY 1,2
 ORDER BY 1,2
