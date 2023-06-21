import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {expect} from 'chai'
import { NFTDutchAuction_ERC20Bids } from "../typechain-types";
const hre = require("hardhat");
// const { ERC20, ERC721 } = require("@openzeppelin/contracts");


const _reservePrice = "100";
const _numBlocksAuctionOpen = 50;
const _offerPriceDecrement = "1";

describe("DutchAuction", function () {
  
  async function deployDutchAuctionTestFixture() 
  {
    const [owner, firstAcc, secondAcc] = await ethers.getSigners();

    const nftAuctionFactory = await ethers.getContractFactory("MyNFT");
    const nftAuctionContract = await nftAuctionFactory.deploy();
    
    await nftAuctionContract.mintNFT(firstAcc.address);

    const tokenAuctionFactory = await ethers.getContractFactory("ERC20Token");
    const tokenAuctionContract = await tokenAuctionFactory.deploy("1000");

    const auctionFactory = await ethers.getContractFactory("NFTDutchAuctionERC20");
    const auctionContract = await auctionFactory.deploy(tokenAuctionContract.address, nftAuctionContract.address, 1, ethers.utils.parseUnits(_reservePrice, 18), _numBlocksAuctionOpen, ethers.utils.parseUnits(_offerPriceDecrement, 18));

    await nftAuctionContract.connect(firstAcc).approve(auctionContract.address, 1);
    await tokenAuctionContract.connect(owner).increaseAllowance(auctionContract.address, ethers.utils.parseUnits("1010", 18));

    return { nftAuctionContract, tokenAuctionContract, auctionContract, owner, firstAcc, secondAcc };
  }

  describe("Deployment", function () 
  {
    
      it("Check if the NFT is successfully escrowed in the auction contract", async function () 
      {
        const { nftAuctionContract, auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);
        
        const contractBalancePre = await nftAuctionContract.balanceOf(auctionContract.address);
        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        const contractBalancePost = await nftAuctionContract.balanceOf(auctionContract.address);
        
        expect(contractBalancePre).to.equal(contractBalancePost.sub(ethers.BigNumber.from("1")));
      });

      it("Check if the NFT is successfully withdrawn from the sellers wallet", async function () 
      {
        const { nftAuctionContract, auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);
        
        const ownerBalancePre = await nftAuctionContract.balanceOf(firstAcc.address);
        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        const ownerBalancePost = await nftAuctionContract.balanceOf(firstAcc.address);

        expect(ownerBalancePre).to.equal(ownerBalancePost.add(ethers.BigNumber.from("1")));
      });

      it("Check if the NFT is being successully transferred to the bidders wallet once the highest bid is received", async function () 
      {
        const { nftAuctionContract, owner, auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);
        
        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        const buyerBalancePre = await nftAuctionContract.balanceOf(owner.address);
        await auctionContract.connect(owner).bid(ethers.utils.parseUnits("200", 18));
        const buyerBalancePost = await nftAuctionContract.balanceOf(owner.address);

        expect(buyerBalancePost).to.equal(buyerBalancePre.add(ethers.BigNumber.from("1")));
      });
      

      it("Check if the ERC20 tokens are deposited into the seller's wallet upon the successful auction completion", async function () 
      {
        const { auctionContract, tokenAuctionContract, owner, firstAcc, secondAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        let sellerBalancePre = await tokenAuctionContract.balanceOf(firstAcc.address);
        await auctionContract.connect(owner).bid(ethers.utils.parseUnits("300", 18));
        let sellerBalancePost = await tokenAuctionContract.balanceOf(firstAcc.address);

        expect(sellerBalancePost).to.equal(sellerBalancePre.add(ethers.utils.parseUnits("300", 18)));
      });

      it("Check if the ERC20 tokens are deducted from the bidder's wallet upon the successful auction completion", async function () 
      {
        const { auctionContract, tokenAuctionContract, owner, firstAcc, secondAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        let sellerBalancePre = await tokenAuctionContract.balanceOf(owner.address);
        await auctionContract.connect(owner).bid(ethers.utils.parseUnits("300", 18));
        let sellerBalancePost = await tokenAuctionContract.balanceOf(owner.address);

        expect(sellerBalancePost).to.equal(sellerBalancePre.sub(ethers.utils.parseUnits("300", 18)));
      });

      it("Check if the NFT is successfully transferred back to the seller's wallet upon a failed auction", async function () 
      {
        const { nftAuctionContract, auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);
        
        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        const sellerBalancePre = await nftAuctionContract.balanceOf(firstAcc.address);
        await hre.network.provider.send("hardhat_mine", ["0x100"]);
        await auctionContract.connect(firstAcc).cancelAuction();
        const sellerBalancePost = await nftAuctionContract.balanceOf(firstAcc.address);

        expect(sellerBalancePre).to.equal(sellerBalancePost.sub(ethers.BigNumber.from("1")));
      });

      it("Check if the (cancelAuction) function can only be triggered by the NFT Owner", async function () 
      {
        const { auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();

        await expect(auctionContract.cancelAuction()).revertedWith("Invalid call, Only owner of this NFT can trigger this call.");
      });

      it("Check if the auction initiater holds the auction NFT", async function () 
      {
        const { auctionContract } = await loadFixture(deployDutchAuctionTestFixture);

        await expect(auctionContract.nftOwnershipTransfer()).revertedWith("Only owner of the NFT can start the auction.");
      });

      it("Check if the auction stops accepting new bids(from bid winner), once a bid is accepted", async function () 
      {
        const { auctionContract, owner, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        await auctionContract.connect(owner).bid(ethers.utils.parseUnits("160", 18));
  
        await expect(auctionContract.connect(owner).bid(ethers.utils.parseUnits("160", 18))).revertedWith("Bids are not being accepted, the auction has ended.");
      });

      it("Check if the auction stops accepting new bids(from participants other than bid winner), once a bid is accepted", async function () 
      {
        const { auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        await auctionContract.bid(ethers.utils.parseUnits("160", 18));
  
        await expect(auctionContract.connect(firstAcc).bid(ethers.utils.parseUnits("160", 18))).revertedWith("Bids are not being accepted, the auction has ended.");
      });

      it("Check if the auction stops considering bids, once the auction close time (block) is elapsed", async function () 
      {
        const { auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
        await hre.network.provider.send("hardhat_mine", ["0x100"]);
        
        await expect(auctionContract.bid(ethers.utils.parseUnits("160", 18))).to.be.revertedWith("Bids are not being accepted, the auction has ended.");
      });

      it("Check if the bids are getting rejected if the bid price is less than the auction minimum price", async function () 
      {
        const { auctionContract, owner, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();

        await expect(auctionContract.connect(owner).bid(ethers.utils.parseUnits("50", 18))).revertedWith("Your bid price is less than the required auction price.");
      });

      it("Check if the bidder transaction is getting rejected, if there is insufficient allowance given to the auction smart contract", async function () 
      {
        const { auctionContract, owner, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
  
        await expect(auctionContract.connect(owner).bid(ethers.utils.parseUnits("1100", 18))).revertedWith("Insufficient Token Allowance.");
      });

      it("Check if the bidder transaction is getting rejected, if there is insufficient balance", async function () 
      {
        const { auctionContract, owner, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

        await auctionContract.connect(firstAcc).nftOwnershipTransfer();
  
        await expect(auctionContract.connect(owner).bid(ethers.utils.parseUnits("1005", 18))).revertedWith("Not enough balance in the wallet.");
      });

      it("Check if the NFT ownership is transferred to the auction smart contract", async function () 
      {
        const { auctionContract, owner, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);
  
        await expect(auctionContract.connect(owner).cancelAuction()).revertedWith("Auction NFT ownership is not transferred.");
      });

    //   let contract;
    //   it('should revert if auction has not started', async () => {

    //     const NFTDutchAuctionERC20 = await ethers.getContractFactory("NFTDutchAuctionERC20");

    //     const { auctionContract, firstAcc } = await loadFixture(deployDutchAuctionTestFixture);

    //     // Attempt to bid without calling escrowNFT
    //     await expect(auctionContract.bid(ethers.utils.parseEther("1"))).to.be.revertedWith("Auction is not started yet!");
    // });    

  });
});
