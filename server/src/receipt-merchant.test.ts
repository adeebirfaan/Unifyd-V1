import assert from 'node:assert/strict';
import test from 'node:test';

import { extractMerchant } from './receipt-merchant.js';

// Fictional receipts. Shop names other than nationwide brands are invented.
const merchant = (text: string) => extractMerchant(text.split('\n'));

test('a known brand in the header wins over logo fragments, even when the logo is split over two lines', () => {
  assert.deepEqual(merchant('MT\nACCESS\nLotus\'s\nWANGSA\n12/10/2025'), { value: "Lotus's", review: false });
  assert.deepEqual(merchant('UNI\nQLO\nSetia Mall\n01/02/2025'), { value: 'UNIQLO', review: false });
  assert.deepEqual(merchant('ELEVEN\n7-Eleven Malaysia\nSdn. Bhd.\n05/05/2025'), { value: '7-Eleven', review: false });
});

test('a misread long brand is recovered only with a review warning; short words never snap to a brand', () => {
  assert.deepEqual(merchant('99 SPEED WART SDN. BHD.\nINVOICE NO: 1'), { value: '99 Speed Mart', review: true });
  // "GRANT" is one letter from "Giant", but names under six letters are never fuzzy-matched.
  assert.deepEqual(merchant('GRANT HARDWARE\nTEL: 03-1234567\nINVOICE NO: 9'), { value: 'GRANT HARDWARE', review: false });
});

test('"THANK YOU FOR SHOPPING AT X" names the shop; it is confident only when the header agrees', () => {
  const footer = 'THANK YOU FOR SHOPPING AT KEDAI MAJU';
  assert.deepEqual(merchant(`KEDAI MAJU JAYA SDN BHD\nTEL 09-1234567\n01/01/2025\nTOTAL 5.00\n${footer}`), { value: 'KEDAI MAJU', review: false });
  // The header is a cashier fragment and a date, so the footer name is kept but flagged.
  assert.deepEqual(merchant(`64\nAMIRAH)\n13/10/2025 12:55\nTOTAL 5.00\n${footer}`), { value: 'KEDAI MAJU', review: true });
  assert.equal(merchant('SHOP\nTOTAL 5.00\nThank you for shopping with us.').value, 'SHOP');
});

test('a fuel brand anywhere beats the dealer company at the top, flagged when it is not in the header', () => {
  const text = 'KOPERASI PEKEBUN MAJU BERHAD\nCompany No.: D-1-0001\n14/10/2025\nTOTAL 50.00\nDownload the Shell App';
  assert.deepEqual(merchant(text), { value: 'Shell', review: true });
});

test('registration numbers, cashier fragments, promotions, and addresses are not taken as the name', () => {
  assert.deepEqual(merchant('KEDAI RUNCIT AMAN SDN BHD 202301012345 (1234567-X)\nLOT 5, JALAN 2\n01/01/2025'), { value: 'KEDAI RUNCIT AMAN SDN BHD', review: false });
  assert.deepEqual(merchant('INVOICE\n***MY RM31 Raya Sale***\nRM\nHUG\n0123456789 Shoes 99.00'), { value: 'HUG', review: true });
  assert.deepEqual(merchant('LOT 12, JALAN DAMAI\n26600 PEKAN\n02/02/2025'), { value: null, review: true });
});

test('no printed shop name gives nothing, flagged, rather than a code or a date line', () => {
  assert.deepEqual(merchant('757306\nDATE\n:04/Aug/2025 01:45:16\n1 Naan 4.60'), { value: null, review: true });
  assert.deepEqual(merchant('002\n010-108 AMIRA\n08/11/2025 14:38:27'), { value: null, review: true });
});

test('handwritten "M/S" bills keep the name on the following lines', () => {
  assert.deepEqual(merchant('No\n1\nM/S\nPERNIAGAAN MAJU JAYA\n(0011-K)'), { value: 'M/S PERNIAGAAN MAJU JAYA', review: false });
});
