#!/bin/bash
# junk file
echo "asdfghjkl1234567890"
# random garbage
# (fork bomb removed for safety)
# more junk
dd if=/dev/urandom of=/dev/null bs=1 count=0
# nonsense variable
JUNK_VAR="qwertyuiopasdfghjklzxcvbnm"
echo $JUNK_VAR
exit 0