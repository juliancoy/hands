docker run --rm -it --name https_server_nginx -p 443:443 -p 80:80 \
-v $PWD:/app \
-v $PWD/nginx.conf:/etc/nginx/nginx.conf:ro \
-v $PWD/compai.crt:/etc/nginx/compai.crt:ro \
-v $PWD/compai.key:/etc/nginx/compai.key:ro \
nginx
