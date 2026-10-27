// Independent BC7 test oracle: iOrange/bcdec (see LICENSE.bcdec).
#define BCDEC_IMPLEMENTATION
#include "bcdec.h"
#include <stdio.h>

int main(void) {
    unsigned char encoded[16], decoded[64];
    while (fread(encoded, 1, sizeof encoded, stdin) == sizeof encoded) {
        bcdec_bc7(encoded, decoded, 16);
        if (fwrite(decoded, 1, sizeof decoded, stdout) != sizeof decoded)
            return 2;
    }
    return ferror(stdin) ? 1 : 0;
}
