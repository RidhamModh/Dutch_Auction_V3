// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyNFT is ERC721{
    using Counters for Counters.Counter;
    Counters.Counter public tokenIds;

    constructor() ERC721("MyNFT", "NFT") {}

    function mintNFT(address recipient) public
    {
        tokenIds.increment();

        uint newItem = tokenIds.current();
        _safeMint(recipient, newItem);
    }
}
