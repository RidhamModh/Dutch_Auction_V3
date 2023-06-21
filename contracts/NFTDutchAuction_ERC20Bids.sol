// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract NFTDutchAuctionERC20{

    address payable seller;

    uint256 public reservePrice;
    uint256 public numBlocksAuctionOpen;
    uint256 public offerPriceDecrement;     
    uint256 public initialPrice;

    uint256 public startingBlock;
    uint256 public endingBlock;

    bool auctionEnded = false;
    bool auctionStart = false;
    IERC721 public nft;
    uint nftTokenID;
    
    IERC20 public tokenToBid;

    constructor(address erc20TokenAddress, address erc721TokenAddress, uint256 _nftTokenId, uint _reservePrice, uint _numBlocksAuctionOpen, uint _offerPriceDecrement)
    {
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        nft = IERC721(erc721TokenAddress);
        nftTokenID = _nftTokenId;
        tokenToBid = IERC20(erc20TokenAddress);
    }

    function nftOwnershipTransfer() public
    {
        seller = payable(msg.sender);
        require(nft.ownerOf(nftTokenID) == seller, "Only owner of the NFT can start the auction.");
        nft.safeTransferFrom(seller, address(this), nftTokenID);
        startingBlock = block.number;
        endingBlock = startingBlock + numBlocksAuctionOpen;
        auctionStart = true;
        initialPrice = reservePrice + (offerPriceDecrement * numBlocksAuctionOpen);
    }

    function bid(uint amount) public payable
    {
        require(auctionStart == true, "Auction is not started yet!");
        require(auctionEnded == false && (block.number < endingBlock), "Bids are not being accepted, the auction has ended.");
        uint blocksRemaining = endingBlock - block.number;
        uint currPrice = initialPrice - (blocksRemaining * offerPriceDecrement);
        require(amount >= currPrice, "Your bid price is less than the required auction price.");
        
        require(nft.ownerOf(nftTokenID) == address(this),"Auction NFT ownership is not transferred.");
        require(tokenToBid.allowance(msg.sender, address(this)) >= amount, "Insufficient Token Allowance.");
        require(tokenToBid.balanceOf(msg.sender) >= amount, "Not enough balance in the wallet.");
        tokenToBid.transferFrom(msg.sender, seller, amount);
        nft.safeTransferFrom(address(this), msg.sender, nftTokenID);
        auctionEnded = true;
    }


    function cancelAuction() public
    {   
        require(nft.ownerOf(nftTokenID) == address(this),"Auction NFT ownership is not transferred.");
        require(msg.sender == seller, "Invalid call, Only owner of this NFT can trigger this call.");
        require(auctionEnded == false, "Cannot halt the auction as it is successfully completed.");
        require(block.number > endingBlock, "Cannot halt the auction as it is in the process.");
        auctionEnded = true;
        nft.safeTransferFrom(address(this), seller, nftTokenID);
    }

    function onERC721Received(address operator, address from, uint tokenId, bytes calldata data) public view returns(bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

}