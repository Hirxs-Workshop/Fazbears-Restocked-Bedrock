tag @s add selected
execute at @s positioned ~~~ run execute at @p[rym=-45,ry=45] positioned ~~~ run execute at @e[r=3,c=1,tag=selected] positioned ~~~ run tp @s ~ ~ ~0.5
execute at @s positioned ~~~ run execute at @p[rym=45,ry=135] positioned ~~~ run execute at @e[r=3,c=1,tag=selected] positioned ~~~ run tp @s ~-0.5 ~ ~
execute at @s positioned ~~~ run execute at @p[rym=135,ry=180] positioned ~~~ run execute at @e[r=3,c=1,tag=selected] positioned ~~~ run tp @s ~ ~ ~-0.5
execute at @s positioned ~~~ run execute at @p[rym=-180,ry=-135] positioned ~~~ run execute at @e[r=3,c=1,tag=selected] positioned ~~~ run tp @s ~ ~ ~-0.5
execute at @s positioned ~~~ run execute at @p[rym=-135,ry=-45] positioned ~~~ run execute at @e[r=3,c=1,tag=selected] positioned ~~~ run tp @s ~0.5 ~ ~
tag @s remove selected