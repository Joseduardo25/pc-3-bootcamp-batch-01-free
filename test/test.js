const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const { getRole, deploySC, deploySCNoUp, ex, pEth } = require("../utils");

const MINTER_ROLE = getRole("MINTER_ROLE");
const BURNER_ROLE = getRole("BURNER_ROLE");

// 17 de Junio del 2023 GMT
var startDate = 1686960000;

var makeBN = (num) => ethers.BigNumber.from(String(num));

describe("MI PRIMER TOKEN TESTING", function () {
  var nftContract, publicSale, miPrimerToken, usdc;
  var owner, gnosis, alice, bob, carl, deysi;
  var name = "PC3 NFT";
  var symbol = "PC3NFT";
  const cienmilTokens = pEth("100000");
  const diezmilTokens = pEth("10000");


  before(async () => {
    [owner, gnosis, alice, bob, carl, deysi, relayer] = await ethers.getSigners();
  });

  // Estos dos métodos a continuación publican los contratos en cada red
  // Se usan en distintos tests de manera independiente
  // Ver ejemplo de como instanciar los contratos en deploy.js
  async function deployNftSC() {
    //la funcion NFT esta en munbai
    nftContract = await deploySC("PC3NFTUpgradeable",[]);
    //se asigna el rol de minter al relayer
    //"grandRole" es una funcion de openzeppelin que nos permite asignar roles
    await ex(nftContract, "grantRole",[MINTER_ROLE, relayer.address],"GR");
  };

  async function deployPublicSaleSC() {
    miPrimerToken = await deploySC("PC3TokenUpgradeable",[]);
    publicSale = await deploySC("PublicSale",[]);
    //EX de execute, recibe un contrato, una funcion que se va a ejecutar y los parametros
    // contrato, nombre de la funcion, los argunmentos de la funcino y el codigo para errores
    await ex(publicSale, "setPC3Token",[miPrimerToken.address], "SPC3");
    await ex(publicSale, "setGnosisWallet", [gnosis.address],"SGW");
    await ex(publicSale, "setNumberNFTs", [30], "SetUp Number NFTs");
    await ex(miPrimerToken, "mint", [bob.address, cienmilTokens], "KTN Mint");
  };

  describe("Mi Primer Nft Smart Contract", () => {
    // Se publica el contrato antes de cada test
    beforeEach(async () => {
    //ejecutar algo antes de cada test, se llama por cada IT
      await deployNftSC();
    });
    //primer argumento es el nombre del test y el segundo es siempre una funcion asincrona
    it("Verifica nombre colección", async () => {
      //espera el resultado de la funcion nftContract.name
      expect(await nftContract.name()).to.be.equal(name);
    });

    it("Verifica símbolo de colección", async () => {
      expect(await nftContract.symbol()).to.equal(symbol);
    });

    it("No permite acuñar sin privilegio", async () => {
      // Bob llama al metodo de acuñar NFT pero la ejecucion es revertida por no tener permisos
      // var message = "AccessControl: account " + owner.address + " is missing role " + MINTER_ROLE;
      var messageError = `AccessControl: account ${bob.address.toLowerCase()} is missing role ${MINTER_ROLE}`;
      // 1 es el ID
      //BOB es una wallet
      //BOB.ADDRESS es una address
      // un console.log para ver el objeto bob
      await expect(nftContract.connect(bob).safeMint(bob.address,1)).to.be.revertedWith(messageError);

    });

    it("No permite acuñar doble id de Nft", async () => {
      // Se acuña el NFT con ID
      await nftContract.connect(relayer).safeMint(bob.address,1);
      // Se intenta acuñar el mismo NFt con el mismo ID y debe fallar
      await expect(nftContract.connect(relayer).safeMint(bob.address,1)).to.be.revertedWith("ERC721: token already minted");
    });

    it("Verifica rango de Nft: [1, 30]", async () => {
      // Mensaje error: "NFT: Token id out of range"
      await expect(nftContract.connect(relayer).safeMint(bob.address,31)).to.be.revertedWith("NFT: Token id out of range");
    });

    it("Se pueden acuñar todos (30) los Nfts", async () => {
      for( var i = 0; i < 30; i++){
        expect(await nftContract.connect(relayer).safeMint(bob.address,i)).to.be.ok;
      }
    });
  });

  describe("Public Sale Smart Contract", () => {
    // Se publica el contrato antes de cada test
    beforeEach(async () => {
      await deployPublicSaleSC();
    });

    it("No se puede comprar otra vez el mismo ID", async () => {
      //Se da permiso de tokens al contrato de compra y venta para 2 tokens
      await miPrimerToken.connect(bob).approve(publicSale.address,diezmilTokens);
      //Se compra el token 1
      await publicSale.connect(bob).purchaseNftById(1);
      //Se espera que sea revertido, pues se intenta comprar el mismo ID
      await expect(publicSale.connect(bob).purchaseNftById(1)).to.be.revertedwidth("Public Sale: ID not available");
    });

    it("IDs aceptables: [1, 30]", async () => {
      //Se da permiso de tokens al contrato de compra y venta para 1 token
      await miPrimerToken.connect(bob).approve(publicSale.address, diezmilTokens);
      //Comprar un id por encima del limite es revertido
      await expect(publicSale.connect(bob).purchaseNftById(31).to.be.revertedwidth("Public Sale: Token ID put of range"));
    });

    it("Usuario no dio permiso de MiPrimerToken a Public Sale", async () => {
      //se intenta comprar sin permiso, es revertido
      await expect(publicSale.connect(bob).purchaseNftById(1).to.be.revertedwidth("Public Sale: Not enough allowance"));
    });

    it("Usuario no tiene suficientes MiPrimerToken para comprar", async () => {
      //Se aprueban tokens al contrato
      await miPrimerToken.connect(carl).approve(publicSale.address, diezmilTokens);
      //Carl, usuario sin fondos intenta comprar
      await expect(publicSale.connect(carl).purchaseNftById(1).to.be.revertedwidth("Public Sale: Not enough token balance"));
    });

    describe("Compra grupo 1 de NFT: 1 - 10", () => {
      var id = 1;
      var priceNFT = 500;
      var feeGenosis = priceNFT * 0.1;
      var feePublicSale = priceNFT - feeGenosis;
      //Se da allowance en cada uno con la cuenta de bob que tiene tokens para no tener problemas de alowwanc
      beforeEach(async () => {
        await miPrimerToken.connect(bob).approve(publicSale.address, cienmilTokens);
      });
      it("Emite evento luego de comprar", async () => {
        // modelo para validar si evento se disparo con correctos argumentos
        // var tx = await publicSale.purchaseNftById(id);
        // await expect(tx)
        //   .to.emit(publicSale, "DeliverNft")
        //   .withArgs(owner.address, counter);

        var tx = await publicSale.connect(bob).purchaseNftById(id);
        await expect(tx).to.emit(publicSale, "DeliverNft").withArgs(bob.address, id);
      });

      it("Disminuye balance de MiPrimerToken luego de compra", async () => {
        // Usar changeTokenBalance
        // source: https://ethereum-waffle.readthedocs.io/en/latest/matchers.html#change-token-balance
        balanceChange =pEth((-priceNFT).toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, bob, balanceChange);
      });

      it("Gnosis safe recibe comisión del 10% luego de compra", async () => {
        gnosisFee =pEth(feeGenosis.toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, gnosis, gnosisFee);
      });

      it("Smart contract recibe neto (90%) luego de compra", async () => {
        publicSaleFee =pEth(feePublicSale.toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, publicSale, publicSaleFee);
      });
    });

    describe("Compra grupo 2 de NFT: 11 - 20", () => {
      var id = 12;
      var priceNFT = 1000;
      var feeGenosis = priceNFT * 0.1;
      var feePublicSale = priceNFT - feeGenosis;
      //Se da allowance en cada uno con la cuenta de bob que tiene tokens para no tener problemas de alowwanc
      beforeEach(async () => {
        await miPrimerToken.connect(bob).approve(publicSale.address, cienmilTokens);
      });
      it("Emite evento luego de comprar", async () => {
        var tx = await publicSale.connect(bob).purchaseNftById(id);
        await expect(tx).to.emit(publicSale, "DeliverNft").withArgs(bob.address, id);
      });

      it("Disminuye balance de MiPrimerToken luego de compra", async () => {
        balanceChange =pEth((-priceNFT).toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, bob, balanceChange);
      });

      it("Gnosis safe recibe comisión del 10% luego de compra", async () => {
        gnosisFee =pEth(feeGenosis.toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, gnosis, gnosisFee);        
      });

      it("Smart contract recibe neto (90%) luego de compra", async () => {
        publicSaleFee =pEth(feePublicSale.toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, publicSale, publicSaleFee);
      });
    });

    describe("Compra grupo 3 de NFT: 21 - 30", () => {
      // 17 de Junio del 2023
      const startDate = 1686960000;
      const MAX_PRICE_NFT = 50000;
      var id =23;
      var priceNFT = 10000 + Math.floor((Date.now() -startDate) / 3600) * 1000;
      priceNFT = priceNFT > MAX_PRICE_NFT ? MAX_PRICE_NFT : priceNFT;
      var feeGnosis = priceNFT * 0.1;
      var feePublicSale = priceNFT - feeGnosis;
      beforeEach(async () => {
        await miPrimerToken.connect(bob).approve(publicSale.address, cienmilTokens);
      });
      it("Disminuye balance de MiPrimerToken luego de compra", async () => {
        balanceChange =pEth((-priceNFT).toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, bob, balanceChange);
      });

      it("Gnosis safe recibe comisión del 10% luego de compra", async () => {
        gnosisFee =pEth(feeGnosis.toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, gnosis, gnosisFee);
      });

      it("Smart contract recibe neto (90%) luego de compra", async () => {
        publicSaleFee =pEth(feePublicSale.toString());
        await expect(publicSale.connect(bob).purchaseNftById(id)).to.changeTokenBalance(miPrimerToken, publicSale, publicSaleFee);
      });
    });

    describe("Depositando Ether para Random NFT", () => {
      
      it("Método emite evento (30 veces) ", async () => {
        for(var i = 0; i < 30; i++){
          var tx = await publicSale.connect(bob).depostEthForRandomNft({
              value:pEth("0.01"),
          });
          await expect(tx).to.emit(publicSale, "DeliverNft");
        };
      });

      it("Método falla la vez 31", async () => {
        for(var i = 0; i < 30; i++){
          var tx = await publicSale.connect(bob).depostEthForRandomNft({
              value:pEth("0.01"),
          });
          await expect(tx).to.emit(publicSale, "DeliverNft");
        }
        await expect(publicSale.connect(bob).depostEthForRandomNft({
          value:pEth("0.01"),
        })).to.be.revertedWith("No hay NFTs disponibles");
      });

      it("Envío de Ether y emite Evento (30 veces)", async () => {
        for(var i = 0; i < 30; i++){
          var tx =  bob.sendTransaction({
              to: publicSale.address,
              value:pEth("0.01"),
          })
          await expect(tx).to.emit(publicSale, "DeliverNft");
        }
      });

      it("Envío de Ether falla la vez 31", async () => {
        for(var i = 0; i < 30; i++){
          var tx = await bob.sendTransaction({
              to: publicSale.address,
              value:pEth("0.01"),
          })
          await expect(tx).to.emit(publicSale, "DeliverNft");
        }
        await expect(bob.sendTransaction({
          to: publicSale.address,
          value:pEth("0.01"),
        })).to.be.revertedWith("No hay NFTs disponibles");
      });

      it("Da vuelto cuando y gnosis recibe Ether", async () => {
        var tx = await bob.sendTransaction({
          to: publicSale.address,
          value:pEth("0.02"),
        });
        await expect(tx).to.changeEtherBalances([bob.address, gnosis.address], [pEth("-0.01"),pEth("0.01")]);
        // Usar el método changeEtherBalances
        // Source: https://ethereum-waffle.readthedocs.io/en/latest/matchers.html#change-ether-balance-multiple-accounts
        // Ejemplo:
        // await expect(
        //   await owner.sendTransaction({
        //     to: publicSale.address,
        //     value: pEth("0.02"),
        //   })
        // ).to.changeEtherBalances(
        //   [owner.address, gnosis.address],
        //   [pEth("-0.01"), pEth("0.01")]
        // );
      });
    });
  });
});
