#!/bin/zsh

# run this in the /assets/images folder
arr=(pawn bishop rook king knight queen)

for piece in $arr; do
  convert "${piece}_white.png" -resize 100x100 "${piece}_white.100x100.png"
  convert "${piece}_white.png" -resize 68x68 "${piece}_white.68x68.png"
  convert "${piece}_black.png" -resize 100x100 "${piece}_black.100x100.png"
  convert "${piece}_black.png" -resize 68x68 "${piece}_black.68x68.png"
done

